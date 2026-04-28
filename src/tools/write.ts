import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ValidationError } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class WriteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Write',
    description:
      'Writes a file to the local filesystem. This tool will overwrite the existing file if there is one at the provided path.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to write.',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file.',
        },
      },
      required: ['file_path', 'content'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['file_path', 'content']);

      const filePath = params.file_path as string;
      const content = params.content as string;

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');

      return this.success(`Successfully wrote to ${filePath}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Error writing file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
