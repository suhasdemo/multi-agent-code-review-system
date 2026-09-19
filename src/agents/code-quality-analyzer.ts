import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code for security vulnerabilities, performance problems, maintainability issues, bugs, style problems, and JavaScript/TypeScript best-practice violations.',

  prompt: CODE_QUALITY_ANALYZER_PROMPT,

  tools: [
    'Skill',
    'mcp_github_get_file_contents',
    'mcp_eslint_lint'
  ],

  model: 'inherit',
};