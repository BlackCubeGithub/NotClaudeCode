import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

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
    try {
      const { stdout } = await runGitCommand(['status'], cwd);
      return this.success(stdout);
    } catch (error: unknown) {
      const execErr = error as { message?: string };
      if (execErr.message?.includes('not a git repository')) {
        return this.error(execErr.message);
      }
      return this.error(`Git status failed: ${execErr.message || String(error)}`);
    }
  }
}
