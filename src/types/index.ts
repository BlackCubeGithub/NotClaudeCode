export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ConversationContext {
  messages: Message[];
  workingDirectory: string;
  maxTokens: number;
}

export interface AIResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  finishReason?: string;
}

export interface AIProvider {
  chat(messages: Message[], tools: ToolDefinition[]): Promise<AIResponse>;
  chatStream(
    messages: Message[],
    tools: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown>;
  getModel?(): string;
}

export * from './session';
export * from './skill';
