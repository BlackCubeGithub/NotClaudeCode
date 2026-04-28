import { spawn as spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult } from '../../types';

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

export function isGitRepository(cwd: string): boolean {
  try {
    return fs.existsSync(cwd) && fs.statSync(cwd).isDirectory() && fs.existsSync(path.join(cwd, '.git'));
  } catch {
    return false;
  }
}

export async function runGitCommand(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  if (!isGitRepository(cwd)) {
    throw new Error(
      `fatal: not a git repository (or any of the parent directories): .git\n` +
      `  (set path to a valid git repository, or omit to use current working directory)`
    );
  }
  return new Promise((resolve, reject) => {
    const proc = spawnSync('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err: Record<string, unknown> = { code, stderr };
        reject(Object.assign(new Error(stderr || `git exited with code ${code}`), err));
      }
    });
    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('git command not found — is Git installed and in PATH?'));
      } else {
        reject(err);
      }
    });
  });
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
  args: string[],
  cwd: string
): Promise<ToolResult> {
  const { stdout, stderr } = await runGitCommand(args, cwd);
  if (stderr && !stdout) {
    return { success: false, error: stderr };
  }
  return { success: true, output: stdout || stderr || '(no output)' };
}
