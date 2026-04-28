import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

export class GitPullTool extends BaseTool {
  definition = getToolDefinition(
    'GitPull',
    'Pulls changes from a remote repository into the current branch.',
    {
      remote: {
        type: 'string',
        description: 'The remote to pull from (e.g., origin).',
      },
      branch: {
        type: 'string',
        description: 'The branch to pull from.',
      },
      cwd: {
        type: 'string',
        description: 'The working directory of the git repository.',
      },
    },
    []
  );

  async execute(params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
    const cwd = (params.cwd as string) || process.cwd();
    const remote = (params.remote as string) || 'origin';
    const branch = (params.branch as string) || '';

    const args = ['pull'];
    if (branch) {
      args.push(remote, branch);
    } else {
      args.push(remote);
    }

    try {
      const { stdout, stderr } = await runGitCommand(args, cwd);
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(pull completed)');
    } catch (error: unknown) {
      const execErr = error as { message?: string };
      const msg = execErr.message || String(error);
      return this.error(
        `Git pull failed: ${msg}`
      );
    }
  }
}
