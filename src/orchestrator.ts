import {
  query,
  type AgentDefinition,
} from '@anthropic-ai/claude-agent-sdk';

import { mcpServersConfig } from './config/mcp.config';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester,
} from './agents';

import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport,
} from './types';

export interface OrchestratorOptions {
  model?: string;
}

export class CodeReviewOrchestrator {
  private readonly model: string;

  constructor(options: OrchestratorOptions = {}) {
    this.model =
      options.model ||
      process.env.ANTHROPIC_MODEL ||
      'claude-sonnet-4-5-20250929';
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!owner || !repo || !Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error(
        `Invalid pull request information: ${owner}/${repo}#${prNumber}`
      );
    }

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const agents: Record<string, AgentDefinition> = {
      'code-quality-analyzer': codeQualityAnalyzer,
      'test-coverage-analyzer': testCoverageAnalyzer,
      'refactoring-suggester': refactoringSuggester,
    };

    let structuredOutput: unknown;

    try {
      const result = query({
        prompt,
        options: {
          model: this.model,

          mcpServers: mcpServersConfig,

          agents,

          /*
           * Task is required so the orchestrator can explicitly delegate
           * work to the three specialized agents.
           *
           * MCP wildcard names allow tools exposed by the configured
           * GitHub and ESLint MCP servers.
           */
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          allowedTools: [
            'Task',
            'mcp_github_get_pull_request',
            'mcp_github_get_pull_request_files',
            'mcp_github_get_file_contents',
            'mcp_github_search_code',
            'mcp_eslint_lint',
          ],

          /*
           * The project contains .claude/skills, so allow the SDK/agents
           * to load project-level skills.
           */
          settingSources: ['project'],

          outputFormat: {
            type: 'json_schema',
            schema: ReviewReportJSONSchema,
          },

          maxTurns: 40,
        },
      });

      for await (const message of result) {
        if (
          message.type === 'result' &&
          'structured_output' in message &&
          message.structured_output !== undefined
        ) {
          structuredOutput = message.structured_output;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Code review orchestration failed for ${owner}/${repo}#${prNumber}: ${message}`
      );
    }

    if (structuredOutput === undefined) {
      throw new Error(
        `Structured review output was not returned for ${owner}/${repo}#${prNumber}`
      );
    }

    const validation = ReviewReportSchema.safeParse(structuredOutput);

    if (!validation.success) {
      throw new Error(
        `Structured review output validation failed: ${validation.error.message}`
      );
    }

    return validation.data;
  }
}