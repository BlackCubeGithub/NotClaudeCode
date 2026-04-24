import { Message, CompactConfig, DEFAULT_COMPACT_CONFIG } from '../types';
import { countMessagesTokens } from '../utils/token-counter';

export interface CompactResult {
  messages: Message[];
  tokensBefore: number;
  tokensAfter: number;
  toolResultsCleaned: number;
  triggered: boolean;
  reason?: string;
}

export interface ToolResultInfo {
  index: number;
  toolName: string;
  tokenCount: number;
  content: string;
}

function parseToolResultContent(content: string): {
  success?: boolean;
  output?: string;
  error?: string;
  raw: string;
} {
  try {
    const parsed = JSON.parse(content);
    return {
      success: parsed.success,
      output: parsed.output,
      error: parsed.error,
      raw: content,
    };
  } catch {
    return { raw: content };
  }
}

function truncateOutput(output: string, maxLines: number = 10): string {
  if (!output) return '';
  const lines = output.split('\n');
  if (lines.length <= maxLines) {
    return output;
  }
  const halfLines = Math.floor(maxLines / 2);
  const truncated = [
    ...lines.slice(0, halfLines),
    `... [${lines.length - maxLines} lines truncated] ...`,
    ...lines.slice(-halfLines),
  ].join('\n');
  return truncated;
}

function cleanToolResultContent(content: string, maxOutputLines: number = 5): string {
  const parsed = parseToolResultContent(content);
  
  if (parsed.output) {
    const truncatedOutput = truncateOutput(parsed.output, maxOutputLines);
    return JSON.stringify({
      success: parsed.success,
      output: truncatedOutput,
      note: '[Output truncated to save context]',
    });
  }
  
  if (parsed.error) {
    return JSON.stringify({
      success: parsed.success,
      error: parsed.error,
      note: '[Preserved error message]',
    });
  }
  
  return JSON.stringify({
    success: parsed.success,
    note: '[Content cleaned to save context]',
  });
}

function getToolResultInfos(messages: Message[]): ToolResultInfo[] {
  const toolResults: ToolResultInfo[] = [];
  
  messages.forEach((msg, index) => {
    if (msg.role === 'tool') {
      toolResults.push({
        index,
        toolName: msg.name || 'unknown',
        tokenCount: countMessagesTokens([msg]),
        content: msg.content || '',
      });
    }
  });
  
  return toolResults;
}

export function toolResultCleanup(
  messages: Message[],
  contextLimit: number,
  targetUsagePercent: number = 0.7,
  config: CompactConfig = DEFAULT_COMPACT_CONFIG
): CompactResult {
  const tokensBefore = countMessagesTokens(messages);
  const targetTokens = Math.floor(contextLimit * targetUsagePercent);
  
  if (tokensBefore <= targetTokens) {
    return {
      messages,
      tokensBefore,
      tokensAfter: tokensBefore,
      toolResultsCleaned: 0,
      triggered: false,
      reason: `Context usage (${Math.round((tokensBefore / contextLimit) * 100)}%) is within target (${Math.round(targetUsagePercent * 100)}%)`,
    };
  }

  const toolResults = getToolResultInfos(messages);
  
  if (toolResults.length === 0) {
    return {
      messages,
      tokensBefore,
      tokensAfter: tokensBefore,
      toolResultsCleaned: 0,
      triggered: false,
      reason: 'No tool results to clean',
    };
  }

  const tokensToSave = tokensBefore - targetTokens;
  let savedTokens = 0;
  let cleanedCount = 0;
  
  const keepRecent = config.toolResultKeepRecent;
  const toolResultsToClean = toolResults.slice(0, -keepRecent);
  
  const cleanedMessages = [...messages];
  
  for (const toolResult of toolResultsToClean) {
    if (savedTokens >= tokensToSave) {
      break;
    }
    
    const originalContent = cleanedMessages[toolResult.index].content || '';
    const cleanedContent = cleanToolResultContent(originalContent);
    
    const originalTokens = countMessagesTokens([cleanedMessages[toolResult.index]]);
    cleanedMessages[toolResult.index] = {
      ...cleanedMessages[toolResult.index],
      content: cleanedContent,
    };
    const newTokens = countMessagesTokens([cleanedMessages[toolResult.index]]);
    
    savedTokens += (originalTokens - newTokens);
    cleanedCount++;
  }
  
  const tokensAfter = countMessagesTokens(cleanedMessages);

  return {
    messages: cleanedMessages,
    tokensBefore,
    tokensAfter,
    toolResultsCleaned: cleanedCount,
    triggered: cleanedCount > 0,
    reason: cleanedCount > 0 
      ? `Cleaned ${cleanedCount} tool results to reduce context from ${tokensBefore} to ${tokensAfter} tokens`
      : 'No cleaning needed',
  };
}

export function shouldTriggerToolResultCleanup(
  messages: Message[],
  contextLimit: number,
  thresholdPercent: number = 0.7
): boolean {
  const tokens = countMessagesTokens(messages);
  const usagePercent = tokens / contextLimit;
  return usagePercent >= thresholdPercent;
}

export function getToolResultStats(messages: Message[]): {
  count: number;
  totalTokens: number;
  averageTokens: number;
  maxTokens: number;
  minTokens: number;
} {
  const toolResults = messages.filter((m) => m.role === 'tool');
  
  if (toolResults.length === 0) {
    return {
      count: 0,
      totalTokens: 0,
      averageTokens: 0,
      maxTokens: 0,
      minTokens: 0,
    };
  }
  
  const tokenCounts = toolResults.map((msg) => countMessagesTokens([msg]));
  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);
  
  return {
    count: toolResults.length,
    totalTokens,
    averageTokens: Math.round(totalTokens / toolResults.length),
    maxTokens: Math.max(...tokenCounts),
    minTokens: Math.min(...tokenCounts),
  };
}

export function estimateCompactSavings(
  messages: Message[],
  contextLimit: number
): {
  currentUsage: number;
  currentTokens: number;
  targetTokens: number;
  tokensToSave: number;
  toolResultStats: ReturnType<typeof getToolResultStats>;
  estimatedSavings: number;
  canTrigger: boolean;
} {
  const currentTokens = countMessagesTokens(messages);
  const currentUsage = currentTokens / contextLimit;
  const targetTokens = Math.floor(contextLimit * 0.7);
  const tokensToSave = Math.max(0, currentTokens - targetTokens);
  const toolResultStats = getToolResultStats(messages);
  
  const estimatedSavings = Math.floor(toolResultStats.totalTokens * 0.6);
  
  return {
    currentUsage,
    currentTokens,
    targetTokens,
    tokensToSave,
    toolResultStats,
    estimatedSavings,
    canTrigger: toolResultStats.count > 0 && currentUsage > 0.5,
  };
}

export function fullCompact(
  messages: Message[],
  contextLimit: number,
  config: CompactConfig = DEFAULT_COMPACT_CONFIG
): CompactResult {
  const tokensBefore = countMessagesTokens(messages);
  
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');
  
  const keepTokens = Math.floor(contextLimit * 0.3);
  const recentMessages: Message[] = [];
  let currentTokens = 0;
  
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msgTokens = countMessagesTokens([nonSystemMessages[i]]);
    if (currentTokens + msgTokens > keepTokens && recentMessages.length >= config.minMessagesToKeep) {
      break;
    }
    recentMessages.unshift(nonSystemMessages[i]);
    currentTokens += msgTokens;
  }
  
  const compactedMessages = [
    ...systemMessages,
    {
      role: 'user' as const,
      content: `[Context compacted. ${nonSystemMessages.length - recentMessages.length} earlier messages have been summarized. Use /checkpoint to restore previous state if needed.]`,
    },
    ...recentMessages,
  ];

  const tokensAfter = countMessagesTokens(compactedMessages);

  return {
    messages: compactedMessages,
    tokensBefore,
    tokensAfter,
    toolResultsCleaned: 0,
    triggered: true,
    reason: `Full compact: ${nonSystemMessages.length - recentMessages.length} messages compressed`,
  };
}

export function autoCompact(
  messages: Message[],
  contextLimit: number,
  config: CompactConfig = DEFAULT_COMPACT_CONFIG
): CompactResult {
  const currentTokens = countMessagesTokens(messages);
  const usagePercent = currentTokens / contextLimit;
  
  if (usagePercent < 0.7) {
    return {
      messages,
      tokensBefore: currentTokens,
      tokensAfter: currentTokens,
      toolResultsCleaned: 0,
      triggered: false,
      reason: 'Context usage is healthy',
    };
  }
  
  if (usagePercent < 0.85) {
    const result = toolResultCleanup(messages, contextLimit, 0.7, config);
    if (result.triggered) {
      return result;
    }
  }
  
  if (usagePercent >= 0.85) {
    const toolResultResult = toolResultCleanup(messages, contextLimit, 0.6, config);
    if (toolResultResult.tokensAfter < contextLimit * 0.8) {
      return toolResultResult;
    }
    
    return fullCompact(messages, contextLimit, config);
  }
  
  return {
    messages,
    tokensBefore: currentTokens,
    tokensAfter: currentTokens,
    toolResultsCleaned: 0,
    triggered: false,
    reason: 'No compression needed',
  };
}
