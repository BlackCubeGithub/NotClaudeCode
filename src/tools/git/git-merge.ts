import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

export class GitMergeTool extends BaseTool {
  definition = getToolDefinition(
    'GitMerge',
    'Merges a specified branch into the current branch.',
    {
      branch: {
        type: 'string',
        description: 'The branch to merge into the current branch. Required.',
      },
      noFastForward: {
        type: 'boolean',
        description: 'Create a merge commit even when the merge resolves as a fast-forward.',
      },
      squash: {
        type: 'boolean',
        description: 'Squash all commits from the branch into a single commit.',
      },
      cwd: {
        type: 'string',
        description: 'The working directory of the git repository.',
      },
    },
    ['branch']
  );

  async execute(params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
    this.validateRequiredParams(params, ['branch']);

    const cwd = (params.cwd as string) || process.cwd();
    const branch = (params.branch as string) || '';
    const noFastForward = (params.noFastForward as boolean) || false;
    const squash = (params.squash as boolean) || false;

    if (!branch) {
      return this.error('Branch name is required for merge.');
    }

    const args = ['merge'];
    if (noFastForward) {
      args.push('--no-ff');
    }
    if (squash) {
      args.push('--squash');
    }
    args.push(branch);

    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf-8',
      });
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(merge completed with no output)');
    } catch (error: unknown) {
      const execErr = error as { stderr?: string; message?: string };
      return this.error(
        `Git merge failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
