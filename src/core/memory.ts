import { Message, SessionMemory, DEFAULT_SESSION_MEMORY, AIProvider, ToolDefinition } from '../types';
import { countMessagesTokens } from '../utils/token-counter';

export interface MemoryExtractionResult {
  messages: Message[];
  memory: SessionMemory;
  tokensSaved: number;
  messagesSummarized: number;
}

export interface Layer3Result {
  messages: Message[];
  summary: string;
  tokensSaved: number;
  messagesSummarized: number;
}

function extractKeyInformation(messages: Message[]): {
  files: Set<string>;
  tasks: string[];
  decisions: string[];
  problems: string[];
} {
  const files = new Set<string>();
  const tasks: string[] = [];
  const decisions: string[] = [];
  const problems: string[] = [];

  for (const msg of messages) {
    const content = msg.content || '';
    
    const filePathPatterns = [
      /(?:file|path|read|write|edit|create|delete|open)\s*[`'"]?([a-zA-Z]:[\\/][^\s`'"]+|\/[^\s`'"]+)/gi,
      /(?:in|at|from|to)\s+[`'"]?([a-zA-Z]:[\\/][^\s`'"]+|\/[^\s`'"]+)/gi,
    ];
    
    for (const pattern of filePathPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1];
        if (path && (path.includes('/') || path.includes('\\'))) {
          files.add(path.replace(/[`'"]/g, ''));
        }
      }
    }

    if (msg.role === 'assistant') {
      if (content.includes('完成') || content.includes('done') || content.includes('created') || content.includes('implemented')) {
        const sentences = content.split(/[.!?。！？\n]/).filter(s => s.trim().length > 10);
        for (const sentence of sentences) {
          if (sentence.includes('完成') || sentence.includes('created') || sentence.includes('implemented')) {
            tasks.push(sentence.trim().substring(0, 200));
            break;
          }
        }
      }

      if (content.includes('决定') || content.includes('decision') || content.includes('选择') || content.includes('choose')) {
        const sentences = content.split(/[.!?。！？\n]/).filter(s => s.trim().length > 10);
        for (const sentence of sentences) {
          if (sentence.includes('决定') || sentence.includes('decision') || sentence.includes('选择')) {
            decisions.push(sentence.trim().substring(0, 200));
            break;
          }
        }
      }

      if (content.includes('错误') || content.includes('error') || content.includes('问题') || content.includes('problem') || content.includes('fix')) {
        const sentences = content.split(/[.!?。！？\n]/).filter(s => s.trim().length > 10);
        for (const sentence of sentences) {
          if (sentence.includes('错误') || sentence.includes('error') || sentence.includes('问题') || sentence.includes('fix')) {
            problems.push(sentence.trim().substring(0, 200));
            break;
          }
        }
      }
    }
  }

  return {
    files,
    tasks: tasks.slice(-5),
    decisions: decisions.slice(-5),
    problems: problems.slice(-5),
  };
}

function generateProjectOverview(messages: Message[]): string {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) {
    return '';
  }

  const firstUserMessage = userMessages[0].content || '';
  const overview = firstUserMessage.substring(0, 500);
  
  return overview;
}

function generateCurrentState(messages: Message[]): string {
  const recentMessages = messages.slice(-10);
  const assistantMessages = recentMessages.filter(m => m.role === 'assistant');
  
  if (assistantMessages.length === 0) {
    return 'Conversation started';
  }

  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1].content || '';
  const state = lastAssistantMessage.substring(0, 300);
  
  return state || 'Working on task';
}

export function extractSessionMemory(
  messages: Message[],
  existingMemory?: SessionMemory
): SessionMemory {
  const info = extractKeyInformation(messages);
  const overview = existingMemory?.projectOverview || generateProjectOverview(messages);
  const currentState = generateCurrentState(messages);

  const existingFiles = new Set(existingMemory?.importantFiles || []);
  info.files.forEach(f => existingFiles.add(f));

  return {
    projectOverview: overview,
    completedTasks: [...(existingMemory?.completedTasks || []), ...info.tasks].slice(-10),
    keyDecisions: [...(existingMemory?.keyDecisions || []), ...info.decisions].slice(-10),
    currentState,
    importantFiles: Array.from(existingFiles).slice(-20),
    problemsAndSolutions: [...(existingMemory?.problemsAndSolutions || []), ...info.problems].slice(-10),
    lastUpdated: new Date().toISOString(),
  };
}

export function createMemorySummaryMessage(memory: SessionMemory): Message {
  const parts: string[] = [];
  
  if (memory.projectOverview) {
    parts.push(`Project Overview: ${memory.projectOverview.substring(0, 200)}`);
  }
  
  if (memory.completedTasks.length > 0) {
    parts.push(`Completed Tasks:\n${memory.completedTasks.map(t => `- ${t}`).join('\n')}`);
  }
  
  if (memory.keyDecisions.length > 0) {
    parts.push(`Key Decisions:\n${memory.keyDecisions.map(d => `- ${d}`).join('\n')}`);
  }
  
  if (memory.importantFiles.length > 0) {
    parts.push(`Important Files:\n${memory.importantFiles.map(f => `- ${f}`).join('\n')}`);
  }
  
  if (memory.problemsAndSolutions.length > 0) {
    parts.push(`Problems & Solutions:\n${memory.problemsAndSolutions.map(p => `- ${p}`).join('\n')}`);
  }
  
  parts.push(`Current State: ${memory.currentState}`);
  
  return {
    role: 'user',
    content: `[Session Memory Summary]\n${parts.join('\n\n')}\n\n[End of memory summary. Continue from current state.]`,
  };
}

export function layer2Compact(
  messages: Message[],
  contextLimit: number,
  existingMemory?: SessionMemory
): MemoryExtractionResult {
  const tokensBefore = countMessagesTokens(messages);
  
  const memory = extractSessionMemory(messages, existingMemory);
  
  const systemMessages = messages.filter(m => m.role === 'system');
  const recentMessages = messages.slice(-10);
  
  const memoryMessage = createMemorySummaryMessage(memory);
  
  const compactedMessages = [
    ...systemMessages,
    memoryMessage,
    ...recentMessages,
  ];
  
  const tokensAfter = countMessagesTokens(compactedMessages);
  
  return {
    messages: compactedMessages,
    memory,
    tokensSaved: tokensBefore - tokensAfter,
    messagesSummarized: messages.length - compactedMessages.length,
  };
}

export function shouldTriggerLayer2Compact(
  messages: Message[],
  contextLimit: number,
  threshold: number = 0.8
): boolean {
  const tokens = countMessagesTokens(messages);
  const usage = tokens / contextLimit;
  return usage >= threshold;
}

export function formatMemoryForDisplay(memory: SessionMemory): string {
  const lines: string[] = [];
  
  lines.push(`📝 Session Memory (Updated: ${new Date(memory.lastUpdated).toLocaleString()})`);
  lines.push('');
  
  if (memory.projectOverview) {
    lines.push(`Overview: ${memory.projectOverview.substring(0, 100)}...`);
  }
  
  lines.push(`Completed Tasks: ${memory.completedTasks.length}`);
  lines.push(`Key Decisions: ${memory.keyDecisions.length}`);
  lines.push(`Important Files: ${memory.importantFiles.length}`);
  lines.push(`Problems Solved: ${memory.problemsAndSolutions.length}`);
  lines.push('');
  lines.push(`Current State: ${memory.currentState.substring(0, 100)}...`);
  
  return lines.join('\n');
}

function formatConversationForSummary(messages: Message[]): string {
  const parts: string[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    
    const role = msg.role === 'user' ? 'User' : 
                 msg.role === 'assistant' ? 'Assistant' : 'Tool';
    
    let content = '';
    if (msg.content) {
      content = msg.content.substring(0, 500);
    }
    if (msg.tool_calls) {
      content += ` [Called tools: ${msg.tool_calls.map(tc => tc.function.name).join(', ')}]`;
    }
    
    parts.push(`[${role}]: ${content}`);
  }
  
  return parts.join('\n\n');
}

function createSummaryPrompt(messages: Message[]): Message {
  const conversationText = formatConversationForSummary(messages);
  
  return {
    role: 'user',
    content: `Please create a concise summary of the following conversation. Focus on:
1. Main tasks and goals discussed
2. Key decisions made
3. Important files or code mentioned
4. Current progress and next steps

Keep the summary under 500 words. Format it as a structured summary that can be used to continue the conversation.

Conversation:
${conversationText}

Summary:`
  };
}

export async function layer3Compact(
  messages: Message[],
  provider: AIProvider,
  contextLimit: number,
  keepRecentCount: number = 5
): Promise<Layer3Result> {
  const tokensBefore = countMessagesTokens(messages);
  
  const systemMessages = messages.filter(m => m.role === 'system');
  const messagesToSummarize = messages.filter(m => m.role !== 'system').slice(0, -keepRecentCount);
  const recentMessages = messages.slice(-keepRecentCount);
  
  if (messagesToSummarize.length === 0) {
    return {
      messages,
      summary: '',
      tokensSaved: 0,
      messagesSummarized: 0,
    };
  }
  
  const summaryPrompt = createSummaryPrompt(messagesToSummarize);
  
  try {
    const response = await provider.chat([summaryPrompt], []);
    const summary = response.content || '';
    
    const summaryMessage: Message = {
      role: 'user',
      content: `[Previous Conversation Summary]\n${summary}\n[End of summary. Continue from current state.]`,
    };
    
    const compactedMessages = [
      ...systemMessages,
      summaryMessage,
      ...recentMessages,
    ];
    
    const tokensAfter = countMessagesTokens(compactedMessages);
    
    return {
      messages: compactedMessages,
      summary,
      tokensSaved: tokensBefore - tokensAfter,
      messagesSummarized: messagesToSummarize.length,
    };
  } catch (error) {
    console.error('Layer 3 compact failed:', error);
    return {
      messages,
      summary: '',
      tokensSaved: 0,
      messagesSummarized: 0,
    };
  }
}

export function shouldTriggerLayer3Compact(
  messages: Message[],
  contextLimit: number,
  threshold: number = 0.95
): boolean {
  const tokens = countMessagesTokens(messages);
  const usage = tokens / contextLimit;
  return usage >= threshold;
}
