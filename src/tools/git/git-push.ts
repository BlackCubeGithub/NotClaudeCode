import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

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
        description: 'Force push. Use with caution as it can overwrite remote history.',
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
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf-8',
      });
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(push completed)');
    } catch (error: unknown) {
      const execErr = error as { stderr?: string; message?: string };
      return this.error(
        `Git push failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
