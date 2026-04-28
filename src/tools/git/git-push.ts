import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

export class GitPushTool extends BaseTool {
  definition = getToolDefinition(
    'GitPush',
    'Pushes the current branch to the remote repository. Supports force push and optional remote/branch parameters.',
    {
      remote: {
        type: 'string',
        description: 'The remote to push to (e.g., origin).',
      },
      branch: {
        type: 'string',
        description: 'The branch to push.',
      },
      force: {
        type: 'boolean',
        description:
          'Force push. WARNING: This can overwrite remote history and cause permanent data loss. Use only when necessary.',
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
    const force = (params.force as boolean) || false;

    const args = ['push'];
    if (force) {
      args.push('--force');
    }
    if (remote) {
      args.push(remote);
      if (branch) {
        args.push(branch);
      }
    }

    try {
      const { stdout, stderr } = await runGitCommand(args, cwd);
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(push completed)');
    } catch (error: unknown) {
      const execErr = error as { message?: string };
      const msg = execErr.message || String(error);
      if (msg.includes('not a git repository')) {
        return this.error(msg);
      }
      return this.error(
        `Git push failed: ${msg}`
      );
    }
  }
}
