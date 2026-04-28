import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

export class GitLogTool extends BaseTool {
  definition = getToolDefinition(
    'GitLog',
    'Shows the commit history. Use file parameter to show commits that affected a specific file.',
    {
      n: {
        type: 'number',
        description: 'Number of commits to show (default: 10).',
      },
      maxCount: {
        type: 'number',
        description: 'Number of commits to show (alias for n, default: 10).',
      },
      file: {
        type: 'string',
        description: 'Show commits for a specific file.',
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
    const n = ((params.n as number) || (params.maxCount as number) || 10);
    const file = (params.file as string) || '';

    const args = ['log', '--oneline', `-n${n}`];
    if (file) {
      args.push('--', file);
    }

    try {
      const { stdout, stderr } = await runGitCommand(args, cwd);
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(no output)');
    } catch (error: unknown) {
      const execErr = error as { message?: string };
      return this.error(
        `Git log failed: ${execErr.message || String(error)}`
      );
    }
  }
}
