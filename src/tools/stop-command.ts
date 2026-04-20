import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import { runningCommands } from './run-command';

export class StopCommandTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'StopCommand',
    description: 'Terminate a currently running command.',
    parameters: {
      type: 'object',
      properties: {
        command_id: {
          type: 'string',
          description: 'The command id of the running command to terminate.',
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

      if (cmdInfo.status !== 'running') {
        return this.error(`Command is not running: ${commandId}`);
      }

      cmdInfo.process.kill();
      cmdInfo.status = 'done';
      cmdInfo.exitCode = -1;

      return this.success(`Command ${commandId} has been terminated.`);
    } catch (error) {
      return this.error(
        `Error stopping command: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
