import { glob as globFn } from 'glob';
import { BaseTool, ValidationError } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class GlobTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Glob',
    description:
      'Fast file pattern matching tool that works with any codebase size.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern to match files against.',
        },
        path: {
          type: 'string',
          description: 'The directory to search in.',
        },
      },
      required: ['pattern'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['pattern']);

      const pattern = params.pattern as string;
      const cwd = (params.path as string) || process.cwd();

      const files = await globFn(pattern, {
        cwd,
        nodir: true,
        absolute: true,
      });

      if (files.length === 0) {
        return this.success('No files found matching the pattern.');
      }

      return this.success(files.join('\n'));
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Error executing glob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
