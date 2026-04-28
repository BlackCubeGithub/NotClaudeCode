import { BaseTool, ValidationError } from '../base';
import { getToolDefinition, runGitCommand } from './base';

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
    try {
      this.validateRequiredParams(params, ['message']);

      const message = params.message as string;
      const cwd = (params.cwd as string) || process.cwd();
      const amend = (params.amend as boolean) || false;

      if (!message || message.trim().length === 0) {
        return this.error('Commit message cannot be empty.');
      }

      try {
        const { stdout, stderr } = await runGitCommand(['commit', '-m', message, ...(amend ? ['--amend'] : [])], cwd);
        const output = (stdout || stderr || '').trim();
        return this.success(output || '(commit completed)');
      } catch (error: unknown) {
        const execErr = error as { message?: string };
        return this.error(
          `Git commit failed: ${execErr.message || String(error)}`
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Git commit failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
