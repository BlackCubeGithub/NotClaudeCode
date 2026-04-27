import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base';
import { getToolDefinition } from './base';

const execFileAsync = promisify(execFile);

export class GitStashTool extends BaseTool {
  definition = getToolDefinition(
    'GitStash',
    'Stash management tool. Use to save and restore uncommitted changes temporarily.',
    {
      action: {
        type: 'string',
        description: 'The stash action: "save" (default), "pop", "list", "drop", "show", or "clear".',
        enum: ['save', 'pop', 'list', 'drop', 'show', 'clear', 'apply'],
      },
      message: {
        type: 'string',
        description: 'A description for the stash (used with save action).',
      },
      stashRef: {
        type: 'string',
        description: 'The stash reference (e.g., stash@{0}) for pop, drop, show, or apply actions.',
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
    const action = (params.action as string) || 'save';
    const message = (params.message as string) || '';
    const stashRef = (params.stashRef as string) || '';

    const args = ['stash'];

    switch (action) {
      case 'save':
        if (message) {
          args.push('save', message);
        }
        break;
      case 'list':
        args.push('list');
        break;
      case 'pop':
        if (stashRef) {
          args.push('pop', stashRef);
        } else {
          args.push('pop');
        }
        break;
      case 'apply':
        if (stashRef) {
          args.push('apply', stashRef);
        } else {
          args.push('apply');
        }
        break;
      case 'drop':
        if (!stashRef) {
          return this.error('stashRef is required for drop action.');
        }
        args.push('drop', stashRef);
        break;
      case 'show':
        if (stashRef) {
          args.push('show', stashRef);
        } else {
          args.push('show');
        }
        break;
      case 'clear':
        args.push('clear');
        break;
      default:
        return this.error(
          `Unknown action: ${action}. Use save, pop, list, drop, show, apply, or clear.`
        );
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
        `Git stash failed: ${execErr.stderr || execErr.message || String(error)}`
      );
    }
  }
}
