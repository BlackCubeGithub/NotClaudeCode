import * as os from 'os';
import * as path from 'path';
import { Message, Tool, ToolDefinition, ToolResult, StreamChunk, AIProvider } from '../types';
import { getAllTools } from '../tools';

const SYSTEM_PROMPT = `You are NotClaudeCode, a powerful code assistant that helps users with software engineering tasks ,Inspired by Claude Code, developed by Blackcube for learning and research purposes.

You have access to a set of tools you can use to accomplish tasks:
- Read: Read files from the filesystem
- Write: Write files to the filesystem
- Edit: Edit existing files using search and replace
- LS: List directory contents
- Glob: Find files matching a pattern
- Grep: Search file contents
- RunCommand: Execute terminal commands
- CheckCommandStatus: Check status of running commands
- StopCommand: Stop running commands

When working with files:
- Always use absolute paths
- Follow existing code conventions and style
- Never expose secrets or API keys
- Be thorough and careful with file operations

When executing commands:
- Use blocking: true for short-running commands
- Use blocking: false for long-running processes like servers
- Always inform the user about what commands you're running

Current environment:
- OS: ${os.type()} ${os.release()}
- Working Directory: ${process.cwd()}
- Home Directory: ${os.homedir()}

Always be helpful, clear, and educational in your responses.`;

export class Agent {
  private tools: Map<string, Tool>;
  private messages: Message[];
  private provider: AIProvider;

  constructor(
    provider: AIProvider,
    private workingDirectory: string = process.cwd()
  ) {
    this.provider = provider;
    this.tools = new Map();
    this.messages = [];

    const toolList = getAllTools();
    for (const tool of toolList) {
      this.tools.set(tool.definition.name, tool);
    }

    this.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async processUserMessage(userMessage: string): Promise<string> {
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    return this.processLoop();
  }

  async *processUserMessageStream(
    userMessage: string,
    onToolCall?: (toolName: string, params: Record<string, unknown>) => void
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    yield* this.processLoopStream(onToolCall);
  }

  private async *processLoopStream(
    onToolCall?: (toolName: string, params: Record<string, unknown>) => void
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const toolDefs = this.getToolDefinitions();
    const stream = this.provider.chatStream(this.messages, toolDefs);

    let content = '';
    const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];

    for await (const chunk of stream) {
      if (chunk.type === 'content' && chunk.content) {
        content += chunk.content;
        yield chunk;
      }

      if (chunk.type === 'tool_call' && chunk.toolCall) {
        toolCalls.push({
          id: chunk.toolCall.id,
          type: 'function',
          function: {
            name: chunk.toolCall.name,
            arguments: chunk.toolCall.arguments,
          },
        });
      }

      if (chunk.type === 'done') {
        if (toolCalls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls,
          });

          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            const tool = this.tools.get(toolName);

            if (!tool) {
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
              });
              continue;
            }

            let params: Record<string, unknown>;
            try {
              params = JSON.parse(toolCall.function.arguments);
            } catch {
              params = {};
            }

            if (onToolCall) {
              onToolCall(toolName, params);
            }

            const result = await tool.execute(params);

            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result),
            });
          }

          yield* this.processLoopStream(onToolCall);
          return;
        }

        this.messages.push({
          role: 'assistant',
          content: content || null,
        });

        yield { type: 'done', finishReason: chunk.finishReason };
      }
    }
  }

  private async processLoop(): Promise<string> {
    const toolDefs = this.getToolDefinitions();
    let response = await this.provider.chat(this.messages, toolDefs);

    while (response.toolCalls.length > 0) {
      this.messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
          });
          continue;
        }

        let params: Record<string, unknown>;
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          params = {};
        }

        const result = await tool.execute(params);

        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result),
        });
      }

      response = await this.provider.chat(this.messages, toolDefs);
    }

    this.messages.push({
      role: 'assistant',
      content: response.content,
    });

    return response.content || 'Done.';
  }

  getConversationHistory(): Message[] {
    return [...this.messages];
  }

  clearHistory(): void {
    this.messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ];
  }
}
