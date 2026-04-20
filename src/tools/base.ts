import { ToolDefinition, Tool, ToolResult } from '../types';

export abstract class BaseTool implements Tool {
  abstract definition: ToolDefinition;

  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;

  protected validateRequiredParams(
    params: Record<string, unknown>,
    required: string[]
  ): void {
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected error(message: string): ToolResult {
    return { success: false, error: message };
  }
}
