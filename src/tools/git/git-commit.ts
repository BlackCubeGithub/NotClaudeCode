import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

export class GitCommitTool extends BaseTool {
  definition = getToolDefinition(
    'GitCommit',
    'Creates a new git commit with the provided message. Requires a commit message.',
    {
      message: {
        type: 'string',
        description: 'The commit message. Required.',
      },
      cwd: {
        type: 'string',
        description: 'The working directory of the git repository.',
      },
      amend: {
        type: 'boolean',
        description: 'Amend the previous commit instead of creating a new one.',
      },
    },
    ['message']
  );

  async execute(params: Record<string, unknown>): Promise<{ success: boolean; output?: string; error?: string }> {
    this.validateRequiredParams(params, ['message']);

    const message = params.message as string;
    const cwd = (params.cwd as string) || process.cwd();
    const amend = (params.amend as boolean) || false;

    if (!message || message.trim().length === 0) {
      return this.error('Commit message cannot be empty.');
    }

    const args = ['commit', '-m', message];
    if (amend) {
      args.push('--amend');
    }

    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf-8',
      });
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(commit completed)');
    } catch (error: unknown) {
      const execErr = error as { stderr?: string; message?: string };
      return this.error(
        `Git commit failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
