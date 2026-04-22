import OpenAI from 'openai';
import { AIProvider, AIResponse, Message, ToolDefinition, StreamChunk } from '../types';
import { debugLog } from '../utils/debug';

export class QwenProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'qwen-turbo') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    this.model = model;
    debugLog('PROVIDER', `Qwen provider initialized`, { model });
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<AIResponse> {
    debugLog('API', 'Sending chat request', { 
      model: this.model, 
      messageCount: messages.length,
      toolCount: tools.length 
    });

    const openaiMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
      }

      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });

    const openaiTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: openaiTools,
        tool_choice: 'auto',
      });

      const choice = response.choices[0];
      debugLog('API', 'Chat response received', {
        contentLength: choice.message.content?.length,
        toolCallsCount: choice.message.tool_calls?.length || 0,
        finishReason: choice.finish_reason
      });

      return {
        content: choice.message.content,
        toolCalls: (choice.message.tool_calls || []).map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      debugLog('ERROR', 'Chat request failed', error);
      throw error;
    }
  }

  async *chatStream(
    messages: Message[],
    tools: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown> {
    debugLog('API', 'Starting stream request', { 
      model: this.model, 
      messageCount: messages.length,
      toolCount: tools.length 
    });

    const openaiMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
      }

      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });

    const openaiTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    let stream;
    try {
      stream = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: openaiTools,
        tool_choice: 'auto',
        stream: true,
      });
      debugLog('API', 'Stream connection established');
    } catch (error) {
      debugLog('ERROR', 'Stream request failed', error);
      throw error;
    }

    const toolCallsMap = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    let chunkCount = 0;
    try {
      for await (const chunk of stream) {
        chunkCount++;
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;
            const existing = toolCallsMap.get(index) || {
              id: '',
              name: '',
              arguments: '',
            };

            if (toolCallDelta.id) {
              existing.id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              existing.name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              existing.arguments += toolCallDelta.function.arguments;
            }

            toolCallsMap.set(index, existing);
          }
        }

        if (finishReason) {
          debugLog('API', 'Stream completed', { 
            chunkCount, 
            toolCallsCount: toolCallsMap.size,
            finishReason 
          });
          for (const [, toolCall] of toolCallsMap) {
            yield {
              type: 'tool_call',
              toolCall,
            };
          }
          yield {
            type: 'done',
            finishReason,
          };
        }
      }
    } catch (error) {
      debugLog('ERROR', 'Stream processing error', error);
      throw error;
    }
  }
}
