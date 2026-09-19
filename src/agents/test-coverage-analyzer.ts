import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes source files and their corresponding test files to estimate test coverage, identify untested functions, branches, classes, and edge cases, and recommend specific tests.',

  prompt: TEST_COVERAGE_ANALYZER_PROMPT,

  tools: [
    'Read',
    'Grep',
    'Glob',
  ],

  model: 'inherit',
};