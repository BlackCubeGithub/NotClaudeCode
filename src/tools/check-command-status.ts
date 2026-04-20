import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import { runningCommands } from './run-command';

export class CheckCommandStatusTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'CheckCommandStatus',
    description: 'Get the status of a previously executed command by its Command ID.',
    parameters: {
      type: 'object',
      properties: {
        command_id: {
          type: 'string',
          description: 'ID of the command to get status for.',
        },
      },
      required: ['command_id'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['command_id']);

      const commandId = params.command_id as string;
      const cmdInfo = runningCommands.get(commandId);

      if (!cmdInfo) {
        return this.error(`Command not found: ${commandId}`);
      }

      const output = cmdInfo.output.join('');
      const elapsed = Date.now() - cmdInfo.startTime.getTime();

      const statusInfo = [
        `Command: ${cmdInfo.command}`,
        `Status: ${cmdInfo.status}`,
        `Exit Code: ${cmdInfo.exitCode ?? 'N/A'}`,
        `Elapsed: ${Math.floor(elapsed / 1000)}s`,
        '',
        'Output:',
        output || '(no output)',
      ].join('\n');

      return this.success(statusInfo);
    } catch (error) {
      return this.error(
        `Error checking command status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
