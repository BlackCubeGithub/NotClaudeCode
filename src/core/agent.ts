import * as os from 'os';
import * as path from 'path';
import { Message, Tool, ToolDefinition, ToolResult, StreamChunk, AIProvider } from '../types';
import { getAllTools } from '../tools';
import { debugLog } from '../utils/debug';

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
- TodoWrite: Create and manage a task list for tracking progress
- WebSearch: Search the internet using Tavily AI
- WebFetch: Fetch and convert web page content to markdown
- GetTime: Get the current date and time

When working with files:
- Always use absolute paths
- Follow existing code conventions and style
- Never expose secrets or API keys
- Be thorough and careful with file operations

When executing commands:
- Use blocking: true for short-running commands
- Use blocking: false for long-running processes like servers
- Always inform the user about what commands you're running

When using TodoWrite:
- Create a todo list for complex tasks with 3+ steps
- Mark tasks as in_progress when starting work
- Mark tasks as completed immediately after finishing
- Only have ONE task in_progress at a time
- Update the list as you progress through tasks

When using WebSearch:
- Use GetTime first to get the current date for time-sensitive queries
- Use for real-time information, current events, or topics you're unsure about
- Be cautious as frequent searches impact user experience
- Prefer WebFetch for detailed content from specific URLs

When using GetTime:
- Use this tool when you need to know the current date or time
- Especially important before WebSearch for time-sensitive queries like news, weather, stock prices

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
    debugLog('AGENT', 'Starting stream request', { messageCount: this.messages.length });
    
    const stream = this.provider.chatStream(this.messages, toolDefs);

    let content = '';
    const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];

    for await (const chunk of stream) {
      if (chunk.type === 'content' && chunk.content) {
        content += chunk.content;
        yield chunk;
      }

      if (chunk.type === 'tool_call' && chunk.toolCall) {
        debugLog('TOOL_CALL', `Received tool call: ${chunk.toolCall.name}`, {
          id: chunk.toolCall.id,
          arguments: chunk.toolCall.arguments,
        });
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
        debugLog('AGENT', 'Stream completed', { contentLength: content.length, toolCallsCount: toolCalls.length });
        
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
              debugLog('ERROR', `Unknown tool: ${toolName}`);
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

            debugLog('TOOL_EXEC', `Executing tool: ${toolName}`, params);

            if (onToolCall) {
              onToolCall(toolName, params);
            }

            const result = await tool.execute(params);
            debugLog('TOOL_RESULT', `Tool result for ${toolName}`, { 
              success: result.success,
              outputLength: result.output?.length 
            });

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

  getContextStats(): {
    totalTokens: number;
    totalChars: number;
    breakdown: {
      system: { tokens: number; chars: number; percentage: number };
      user: { tokens: number; chars: number; percentage: number };
      assistant: { tokens: number; chars: number; percentage: number };
      tool: { tokens: number; chars: number; percentage: number };
    };
    messageCount: {
      system: number;
      user: number;
      assistant: number;
      tool: number;
      total: number;
    };
  } {
    const countTokens = (text: string | null): number => {
      if (!text) return 0;
      return Math.ceil(text.length / 4);
    };

    const stats = {
      system: { tokens: 0, chars: 0, percentage: 0 },
      user: { tokens: 0, chars: 0, percentage: 0 },
      assistant: { tokens: 0, chars: 0, percentage: 0 },
      tool: { tokens: 0, chars: 0, percentage: 0 },
    };

    const messageCount = {
      system: 0,
      user: 0,
      assistant: 0,
      tool: 0,
      total: this.messages.length,
    };

    for (const msg of this.messages) {
      const content = msg.content || '';
      const tokens = countTokens(content);
      const chars = content.length;

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const argsTokens = countTokens(tc.function.arguments);
          stats[msg.role].tokens += argsTokens;
          stats[msg.role].chars += tc.function.arguments.length;
        }
      }

      stats[msg.role].tokens += tokens;
      stats[msg.role].chars += chars;
      messageCount[msg.role]++;
    }

    const totalTokens = Object.values(stats).reduce((sum, s) => sum + s.tokens, 0);
    const totalChars = Object.values(stats).reduce((sum, s) => sum + s.chars, 0);

    for (const role of Object.keys(stats) as Array<keyof typeof stats>) {
      stats[role].percentage = totalTokens > 0 
        ? Math.round((stats[role].tokens / totalTokens) * 100) 
        : 0;
    }

    return {
      totalTokens,
      totalChars,
      breakdown: stats,
      messageCount,
    };
  }
}
