import * as fs from 'fs';
import { BaseTool, ValidationError } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class ReadTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Read',
    description:
      'Reads a file from the local filesystem. You can access any file directly by using this tool.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to read.',
        },
        offset: {
          type: 'number',
          description: 'The line number to start reading from.',
        },
        limit: {
          type: 'number',
          description: 'The number of lines to read.',
        },
      },
      required: ['file_path'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['file_path']);

      const filePath = params.file_path as string;
      const offset = (params.offset as number) || 0;
      const limit = params.limit as number | undefined;

      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const startLine = Math.max(0, offset);
      const endLine = limit ? startLine + limit : lines.length;

      const selectedLines = lines.slice(startLine, endLine);
      const numberedLines = selectedLines
        .map((line, index) => `${startLine + index + 1}\t${line}`)
        .join('\n');

      return this.success(numberedLines);
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Error reading file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
