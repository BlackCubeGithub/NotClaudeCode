import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

export class GitDiffTool extends BaseTool {
  definition = getToolDefinition(
    'GitDiff',
    'Shows changes between commits, commit and working tree, or working tree files. Use --cached to show staged changes.',
    {
      file: {
        type: 'string',
        description: 'Show diff for a specific file or directory.',
      },
      cached: {
        type: 'boolean',
        description: 'Show staged changes instead of working tree changes.',
      },
      staged: {
        type: 'boolean',
        description: 'Alias for cached — show staged changes.',
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
    const file = (params.file as string) || '';
    const cached = (params.cached as boolean) || (params.staged as boolean) || false;

    const args = ['diff'];
    if (cached) {
      args.push('--cached');
    }
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
        `Git diff failed: ${execErr.message || String(error)}`
      );
    }
  }
}
