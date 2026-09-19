import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';

function createValidReport() {
  return {
    pullRequest: {
      owner: 'airamane',
      repo: 'simple-todo-app',
      number: 1,
    },
    fileReviews: [
      {
        file: 'src/example.ts',
        codeQuality: {
          file: 'src/example.ts',
          issues: [],
          overallScore: 90,
          summary: 'No significant code quality issues found.',
        },
        testCoverage: {
          file: 'src/example.ts',
          hasTests: true,
          testFiles: ['tests/example.test.ts'],
          untestedPaths: [],
          coverageEstimate: 90,
          summary: 'Good test coverage.',
        },
        refactorings: {
          file: 'src/example.ts',
          suggestions: [],
          summary: 'No significant refactoring opportunities.',
        },
      },
    ],
    summary: {
      totalFiles: 1,
      overallScore: 90,
      criticalIssues: 0,
      highPriorityTests: 0,
      refactoringOpportunities: 0,
    },
    recommendations: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: 1000,
      agentVersions: {
        'code-quality-analyzer': '1.0',
        'test-coverage-analyzer': '1.0',
        'refactoring-suggester': '1.0',
      },
    },
  };
}

function mockSuccessfulQuery() {
  queryMock.mockReturnValue(
    (async function* () {
      yield {
        type: 'result',
        structured_output: createValidReport(),
      };
    })()
  );
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();

      expect(orchestrator).toBeDefined();
    });

    it('should accept a custom model configuration', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator({
        model: 'test-model',
      });

      await orchestrator.reviewPullRequest(
        'airamane',
        'simple-todo-app',
        1
      );

      expect(queryMock).toHaveBeenCalledTimes(1);

      const call = queryMock.mock.calls[0]?.[0];

      expect(call.options.model).toBe('test-model');
    });
  });

  describe('reviewPullRequest', () => {
    it('should reject an invalid pull request number', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'airamane',
          'simple-todo-app',
          0
        )
      ).rejects.toThrow();
    });

    it('should spawn all 3 specialized agents', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'airamane',
        'simple-todo-app',
        1
      );

      const call = queryMock.mock.calls[0]?.[0];

      expect(call.options.agents).toHaveProperty(
        'code-quality-analyzer'
      );

      expect(call.options.agents).toHaveProperty(
        'test-coverage-analyzer'
      );

      expect(call.options.agents).toHaveProperty(
        'refactoring-suggester'
      );

      expect(Object.keys(call.options.agents)).toHaveLength(3);
    });

    it('should include Task and MCP tools in allowed tools', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'airamane',
        'simple-todo-app',
        1
      );

      const call = queryMock.mock.calls[0]?.[0];

      expect(call.options.allowedTools).toContain('Task');

expect(call.options.allowedTools).toContain(
  'mcp_github_get_pull_request'
);

expect(call.options.allowedTools).toContain(
  'mcp_github_get_pull_request_files'
);

expect(call.options.allowedTools).toContain(
  'mcp_github_get_file_contents'
);

expect(call.options.allowedTools).toContain(
  'mcp_github_search_code'
);

expect(call.options.allowedTools).toContain(
  'mcp_eslint_lint'
);
    });

    it('should aggregate results into ReviewReport', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'airamane',
        'simple-todo-app',
        1
      );

      expect(result.pullRequest.owner).toBe('airamane');
      expect(result.pullRequest.repo).toBe('simple-todo-app');
      expect(result.pullRequest.number).toBe(1);

      expect(result.fileReviews).toHaveLength(1);
      expect(result.summary.totalFiles).toBe(1);
      expect(result.metadata).toBeDefined();
    });

    it('should validate output with Zod schema', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'airamane',
        'simple-todo-app',
        1
      );

      expect(result.summary.overallScore).toBe(90);
      expect(result.fileReviews[0]?.codeQuality.overallScore).toBe(90);
    });

    it('should fail gracefully when structured output is missing', async () => {
      queryMock.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
          };
        })()
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'airamane',
          'simple-todo-app',
          1
        )
      ).rejects.toThrow(/Structured review output was not returned/);
    });

    it('should fail when structured output does not match the schema', async () => {
      queryMock.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            structured_output: {
              invalid: true,
            },
          };
        })()
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'airamane',
          'simple-todo-app',
          1
        )
      ).rejects.toThrow(/Structured review output validation failed/);
    });

    it('should wrap SDK failures with a useful error message', async () => {
      queryMock.mockImplementation(() => {
        throw new Error('Mock SDK failure');
      });

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'airamane',
          'simple-todo-app',
          1
        )
      ).rejects.toThrow(
        /Code review orchestration failed.*Mock SDK failure/
      );
    });
  });

  describe('Integration', () => {
    it.skip('should review a real public pull request', async () => {
      // Requires valid Anthropic and GitHub credentials.
      // Run manually with valid API keys.
    });
  });
});