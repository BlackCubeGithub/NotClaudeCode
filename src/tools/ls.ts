import * as fs from 'fs';
import { BaseTool, ValidationError } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class LSTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'LS',
    description: 'Lists files and directories in a given path.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path to the directory to list.',
        },
        ignore: {
          type: 'array',
          items: { type: 'string', description: 'A glob pattern to ignore.' },
          description: 'List of glob patterns to ignore.',
        },
      },
      required: ['path'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['path']);

      const dirPath = params.path as string;
      const ignore = (params.ignore as string[]) || [];

      if (!fs.existsSync(dirPath)) {
        return this.error(`Directory not found: ${dirPath}`);
      }

      if (!fs.statSync(dirPath).isDirectory()) {
        return this.error(`Not a directory: ${dirPath}`);
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const items = entries
        .filter((entry) => {
          if (ignore.length === 0) return true;
          return !ignore.some((pattern) => {
            const regex = new RegExp(
              pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
            );
            return regex.test(entry.name);
          });
        })
        .map((entry) => {
          const isDir = entry.isDirectory();
          return `${isDir ? '📁' : '📄'} ${entry.name}${isDir ? '/' : ''}`;
        });

      return this.success(items.join('\n') || '(empty directory)');
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Error listing directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
