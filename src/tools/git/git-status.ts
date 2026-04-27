import { BaseTool } from '../base';
import {
  getToolDefinition,
  runGitCommand,
  runGitCommandSafe,
} from './base';

export class GitStatusTool extends BaseTool {
  definition = getToolDefinition(
    'GitStatus',
    'Shows the current status of the git repository including staged, modified, untracked, and deleted files.',
    {
      cwd: {
        type: 'string',
        description: 'The working directory of the git repository.',
      },
    },
    []
  );

  async execute(params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
    const cwd = (params.cwd as string) || process.cwd();
    return runGitCommandSafe('git status', cwd);
  }
}
