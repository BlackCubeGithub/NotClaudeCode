import { Message } from '../types';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  const chineseTokens = Math.ceil(chineseChars / 2);
  const otherTokens = Math.ceil(otherChars / 4);
  return chineseTokens + otherTokens;
}

export function countMessageTokens(message: Message): number {
  let total = 0;
  if (message.content) {
    total += estimateTokens(message.content);
  }
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      total += estimateTokens(tc.function.name);
      total += estimateTokens(tc.function.arguments);
    }
  }
  if (message.name) {
    total += estimateTokens(message.name);
  }
  total += 4;
  return total;
}

export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
}

export function selectMessagesToKeep(
  messages: Message[],
  maxTokens: number,
  minMessages: number = 10
): Message[] {
  if (messages.length <= minMessages) {
    return messages;
  }
  const recentMessages: Message[] = [];
  let tokenCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = countMessageTokens(messages[i]);
    if (tokenCount + msgTokens > maxTokens && recentMessages.length >= minMessages) {
      break;
    }
    recentMessages.unshift(messages[i]);
    tokenCount += msgTokens;
  }
  return recentMessages;
}

export function getToolResultCount(messages: Message[]): number {
  return messages.filter((m) => m.role === 'tool').length;
}

export function getAssistantMessageCount(messages: Message[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

export function getContextUsageStats(
  messages: Message[],
  maxContextTokens: number
): {
  totalTokens: number;
  toolResultTokens: number;
  systemTokens: number;
  conversationTokens: number;
  usagePercent: number;
  toolResultCount: number;
  messageCount: number;
} {
  const totalTokens = countMessagesTokens(messages);
  const toolResultMessages = messages.filter((m) => m.role === 'tool');
  const toolResultTokens = countMessagesTokens(toolResultMessages);
  const systemMessages = messages.filter((m) => m.role === 'system');
  const systemTokens = countMessagesTokens(systemMessages);
  const conversationTokens = totalTokens - systemTokens;
  return {
    totalTokens,
    toolResultTokens,
    systemTokens,
    conversationTokens,
    usagePercent: Math.round((totalTokens / maxContextTokens) * 100),
    toolResultCount: toolResultMessages.length,
    messageCount: messages.length,
  };
}

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-3.5-turbo': 16385,
  'deepseek-chat': 64000,
  'deepseek-coder': 16000,
  'glm-4': 128000,
  'glm-4-flash': 128000,
  'qwen-turbo': 8192,
  'qwen-plus': 32768,
  'qwen-max': 8192,
  'moonshot-v1-8k': 8192,
  'moonshot-v1-32k': 32768,
  'moonshot-v1-128k': 128000,
};

export function getModelContextLimit(model: string): number {
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.includes(key)) {
      return limit;
    }
  }
  return 128000;
}
