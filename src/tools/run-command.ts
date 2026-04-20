import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';

interface RunningCommand {
  id: string;
  process: ChildProcess;
  command: string;
  output: string[];
  status: 'running' | 'done' | 'error';
  exitCode: number | null;
  startTime: Date;
}

export const runningCommands = new Map<string, RunningCommand>();

export class RunCommandTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'RunCommand',
    description: 'Run a command on behalf of the user.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to execute.',
        },
        cwd: {
          type: 'string',
          description: 'The working directory to run the command in.',
        },
        blocking: {
          type: 'boolean',
          description: 'Whether to wait for the command to complete.',
        },
        requires_approval: {
          type: 'boolean',
          description: 'Whether the user must approve the command.',
        },
      },
      required: ['command', 'blocking', 'requires_approval'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['command', 'blocking', 'requires_approval']);

      const command = params.command as string;
      const cwd = (params.cwd as string) || process.cwd();
      const blocking = params.blocking as boolean;
      const requiresApproval = params.requires_approval as boolean;

      const commandId = uuidv4();

      return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? true : '/bin/bash';

        const childProcess = spawn(command, [], {
          cwd,
          shell,
          env: { ...process.env, PAGER: 'cat' },
        });

        const cmdInfo: RunningCommand = {
          id: commandId,
          process: childProcess,
          command,
          output: [],
          status: 'running',
          exitCode: null,
          startTime: new Date(),
        };

        runningCommands.set(commandId, cmdInfo);

        childProcess.stdout?.on('data', (data) => {
          cmdInfo.output.push(data.toString());
        });

        childProcess.stderr?.on('data', (data) => {
          cmdInfo.output.push(data.toString());
        });

        childProcess.on('close', (code) => {
          cmdInfo.status = 'done';
          cmdInfo.exitCode = code;
        });

        childProcess.on('error', (error) => {
          cmdInfo.status = 'error';
          cmdInfo.output.push(`Error: ${error.message}`);
        });

        if (blocking) {
          childProcess.on('close', (code) => {
            const output = cmdInfo.output.join('');
            resolve({
              success: code === 0,
              output: `Command ID: ${commandId}\nExit code: ${code}\n\n${output}`,
            });
          });
        } else {
          resolve(
            this.success(
              `Command started with ID: ${commandId}\nUse CheckCommandStatus to check progress.`
            )
          );
        }
      });
    } catch (error) {
      return this.error(
        `Error running command: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
