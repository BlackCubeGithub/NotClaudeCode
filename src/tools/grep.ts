import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';

const execAsync = promisify(exec);

export class GrepTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Grep',
    description: 'A powerful search tool for searching file contents.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regular expression pattern to search for.',
        },
        path: {
          type: 'string',
          description: 'The file or directory to search in.',
        },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'The output mode.',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Case insensitive search.',
        },
        show_line_numbers: {
          type: 'boolean',
          description: 'Show line numbers.',
        },
        glob: {
          type: 'string',
          description: 'Glob pattern to filter files.',
        },
      },
      required: ['pattern'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['pattern']);

      const pattern = params.pattern as string;
      const searchPath = (params.path as string) || '.';
      const outputMode = (params.output_mode as string) || 'files_with_matches';
      const caseInsensitive = params.case_insensitive as boolean;
      const showLineNumbers = params.show_line_numbers as boolean;
      const globPattern = params.glob as string;

      let command = 'grep';
      if (caseInsensitive) command += ' -i';
      if (showLineNumbers || outputMode === 'content') command += ' -n';
      if (outputMode === 'count') command += ' -c';
      if (globPattern) command += ` --include="${globPattern}"`;

      command += ` -r "${pattern}" "${searchPath}"`;

      try {
        const { stdout, stderr } = await execAsync(command, {
          maxBuffer: 1024 * 1024 * 10,
        });

        if (outputMode === 'files_with_matches') {
          const files = stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.split(':')[0]);
          const uniqueFiles = [...new Set(files)];
          return this.success(uniqueFiles.join('\n') || 'No matches found.');
        }

        return this.success(stdout || 'No matches found.');
      } catch (execError: unknown) {
        const execErr = execError as { stdout?: string; stderr?: string };
        if (execErr.stdout) {
          return this.success(execErr.stdout);
        }
        return this.success('No matches found.');
      }
    } catch (error) {
      return this.error(
        `Error executing grep: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
