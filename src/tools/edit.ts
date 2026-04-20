import * as fs from 'fs';
import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class EditTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Edit',
    description:
      'This tool can be used to edit a file. Performs search and replace on a file.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to edit.',
        },
        old_str: {
          type: 'string',
          description: 'The text to search for in the file.',
        },
        new_str: {
          type: 'string',
          description: 'The text to replace the search text with.',
        },
      },
      required: ['file_path', 'old_str', 'new_str'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['file_path', 'old_str', 'new_str']);

      const filePath = params.file_path as string;
      const oldStr = params.old_str as string;
      const newStr = params.new_str as string;

      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      if (!content.includes(oldStr)) {
        return this.error(`Text not found in file: ${oldStr.substring(0, 100)}...`);
      }

      const newContent = content.replace(oldStr, newStr);
      fs.writeFileSync(filePath, newContent, 'utf-8');

      return this.success(`Successfully edited ${filePath}`);
    } catch (error) {
      return this.error(
        `Error editing file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
