import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

export class GitLogTool extends BaseTool {
  definition = getToolDefinition(
    'GitLog',
    'Shows the commit history. Use file parameter to show commits that affected a specific file.',
    {
      n: {
        type: 'number',
        description: 'Number of commits to show (default: 10).',
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
    const n = ((params.n as number) || 10);
    const file = (params.file as string) || '';

    const args = ['log', '--oneline', `-n${n}`];
    if (file) {
      args.push('--', file);
    }

    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd,
        encoding: 'utf-8',
      });
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(no output)');
    } catch (error: unknown) {
      const execErr = error as { stderr?: string; message?: string };
      return this.error(
        `Git log failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
