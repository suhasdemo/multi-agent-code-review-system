/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP servers:
 * 1. GitHub - PR/repository operations
 * 2. ESLint - code linting and style analysis
 */
import 'dotenv/config';
export const mcpServersConfig = {
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  },

  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {},
  },
};