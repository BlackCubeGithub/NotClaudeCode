import { BaseTool } from '../base';
import { getToolDefinition, runGitCommand } from './base';

export class GitBranchTool extends BaseTool {
  definition = getToolDefinition(
    'GitBranch',
    'Lists, creates, renames, or deletes branches.',
    {
      action: {
        type: 'string',
        description: 'The action to perform: "list" (default), "create", "rename", or "delete".',
        enum: ['list', 'create', 'rename', 'delete'],
      },
      name: {
        type: 'string',
        description: 'The branch name for create, rename, or delete actions.',
      },
      newName: {
        type: 'string',
        description: 'The new branch name for rename action.',
      },
      deleteBranch: {
        type: 'boolean',
        description: 'Force delete the branch (equivalent to -D flag).',
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
    const action = (params.action as string) || 'list';
    const name = (params.name as string) || '';
    const newName = (params.newName as string) || '';
    const force = (params.deleteBranch as boolean) || false;

    const args = ['branch'];

    switch (action) {
      case 'list':
        args.push('-a');
        break;
      case 'create':
        if (!name) {
          return this.error('Branch name is required for create action.');
        }
        args.push(name);
        break;
      case 'rename':
        if (!name || !newName) {
          return this.error('Both old and new branch names are required for rename action.');
        }
        args.push('-m', name, newName);
        break;
      case 'delete':
        if (!name) {
          return this.error('Branch name is required for delete action.');
        }
        args.push(force ? '-D' : '-d', name);
        break;
      default:
        return this.error(`Unknown action: ${action}. Use list, create, rename, or delete.`);
    }

    try {
      const { stdout, stderr } = await runGitCommand(args, cwd);
      const output = (stdout || stderr || '').trim();
      return this.success(output || '(no output)');
    } catch (error: unknown) {
      const execErr = error as { message?: string };
      return this.error(
        `Git branch failed: ${execErr.message || String(error)}`
      );
    }
  }
}
