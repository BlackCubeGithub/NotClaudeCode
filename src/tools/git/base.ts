import { exec as execSync } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition, ToolResult } from '../../types';

const execAsync = promisify(execSync);

export interface ParsedStatus {
  current: string | null;
  tracking: string | null;
  staged: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  isClean: boolean;
}

export function formatStatus(status: ParsedStatus): string {
  const lines: string[] = [];

  if (status.current) {
    lines.push(`On branch: ${status.current}`);
    if (status.tracking) {
      lines.push(`Tracking: ${status.tracking}`);
    }
  } else {
    lines.push('Not a git repository (or any of the parent directories): .git');
    return lines.join('\n');
  }

  if (status.ahead > 0 || status.behind > 0) {
    const parts: string[] = [];
    if (status.ahead > 0) parts.push(`${status.ahead} ahead`);
    if (status.behind > 0) parts.push(`${status.behind} behind`);
    lines.push(parts.join(', '));
  }

  if (status.isClean) {
    lines.push('\nNothing to commit, working tree clean');
    return lines.join('\n');
  }

  lines.push('');
  if (status.staged.length > 0) {
    lines.push('Changes staged for commit:');
    for (const file of status.staged) {
      lines.push(`  (staged)    ${file}`);
    }
    lines.push('');
  }
  if (status.modified.length > 0) {
    lines.push('Changes not staged for commit:');
    for (const file of status.modified) {
      lines.push(`  (modified)  ${file}`);
    }
    lines.push('');
  }
  if (status.deleted.length > 0) {
    lines.push('Deleted files:');
    for (const file of status.deleted) {
      lines.push(`  (deleted)   ${file}`);
    }
    lines.push('');
  }
  if (status.untracked.length > 0) {
    lines.push('Untracked files:');
    for (const file of status.untracked) {
      lines.push(`  (untracked) ${file}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export async function runGitCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 1024 * 1024 * 50,
      encoding: 'utf-8',
    });
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (error: unknown) {
    const execErr = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(execErr.stderr || execErr.message || String(error));
  }
}

export function getToolDefinition(
  name: string,
  description: string,
  properties: Record<string, { type: string; description: string; enum?: string[] }>,
  required: string[]
): ToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}

export async function runGitCommandSafe(
  command: string,
  cwd: string
): Promise<ToolResult> {
  const { stdout, stderr } = await runGitCommand(command, cwd);
  if (stderr && !stdout) {
    return { success: false, error: stderr };
  }
  return { success: true, output: stdout || stderr || '(no output)' };
}
