import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Reviews source code for refactoring opportunities including modernization, simplification, extraction of functions, clearer naming, and improved design patterns.',

  prompt: REFACTORING_SUGGESTER_PROMPT,

  tools: [
    'Read',
    'Grep',
    'Glob',
  ],

  model: 'inherit',
};