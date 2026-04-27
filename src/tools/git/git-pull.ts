import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

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
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf-8',
      });
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(pull completed)');
    } catch (error: unknown) {
      const execErr = error as { stderr?: string; message?: string };
      return this.error(
        `Git pull failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
