import * as os from 'os';
import { Message, Tool, ToolDefinition, StreamChunk, AIProvider, DangerousToolCallback, DangerousToolInfo, ToolResult } from '../types';
import { getAllTools } from '../tools';
import { SkillTool } from '../tools/skill';
import { debugLog } from '../utils/debug';
import { SessionManager } from './session-manager';
import { countMessagesTokens, countMessageTokens, getModelContextLimit } from '../utils/token-counter';
import { shouldTriggerToolResultCleanup, toolResultCleanup } from './compact';
import { layer2Compact, layer3Compact } from './memory';
import { ContextMonitor, CompactTriggerResult, createCompactNotificationStream } from './context-monitor';
import { SkillManager } from './skills/skill-manager';
import { ConfigManager } from './config-manager';

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
- Skill: Execute specialized skills for complex workflows
- GitStatus: Shows the current status of the git repository
- GitCommit: Creates a new git commit with a message
- GitPush: Pushes the current branch to a remote repository
- GitPull: Pulls changes from a remote repository
- GitDiff: Shows changes between commits or working tree files
- GitBranch: Lists, creates, renames, or deletes branches
- GitLog: Shows the commit history
- GitMerge: Merges a branch into the current branch
- GitStash: Stashes uncommitted changes temporarily

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

When using Skill:
- Skills provide specialized capabilities and domain knowledge
- Use "list" action to discover available skills
- Invoke skills immediately when relevant to the task
- Skills can automate complex multi-step workflows

Current environment:
- OS: ${os.type()} ${os.release()}
- Working Directory: ${process.cwd()}
- Home Directory: ${os.homedir()}

Always be helpful, clear, and educational in your responses.`;

export class Agent {
  private tools: Map<string, Tool>;
  private messages: Message[];
  private provider: AIProvider;
  private sessionManager?: SessionManager;
  private autoSave: boolean;
  private contextMonitor: ContextMonitor;
  private skillManager: SkillManager;
  private dangerousToolCallback?: DangerousToolCallback;
  private configManager: ConfigManager;
  private beforeToolCallbacks: ((toolName: string, params: Record<string, unknown>) => Promise<{ allowed: boolean; result?: ToolResult }>)[];

  constructor(
    provider: AIProvider,
    private workingDirectory: string = process.cwd(),
    autoSave: boolean = true,
    sessionManager?: SessionManager,
    dangerousToolCallback?: DangerousToolCallback,
    configManager?: ConfigManager
  ) {
    this.provider = provider;
    this.tools = new Map();
    this.sessionManager = sessionManager;
    this.autoSave = autoSave;
    this.dangerousToolCallback = dangerousToolCallback;
    this.beforeToolCallbacks = [];

    // 初始化配置管理器
    this.configManager = configManager || new ConfigManager(workingDirectory);
    this.configManager.load();

    const model = provider.getModel ? provider.getModel() : 'default';
    const contextLimit = getModelContextLimit(model);
    this.contextMonitor = new ContextMonitor({ contextLimit, enableAutoCompact: true });

    const toolList = getAllTools();
    for (const tool of toolList) {
      this.tools.set(tool.definition.name, tool);
    }

    this.skillManager = new SkillManager(this.tools, this.workingDirectory);
    this.skillManager.loadAllSkills();

    const skillTool = this.tools.get('Skill') as SkillTool | undefined;
    if (skillTool) {
      skillTool.setSkillManager(this.skillManager);
    }

    // 构建 system prompt（含项目配置）
    const projectConfig = this.configManager.toSystemPrompt();
    const fullSystemPrompt = projectConfig
      ? `${SYSTEM_PROMPT}\n\n---\n\n## Project Configuration\n\n${projectConfig}\n\n---\n`
      : SYSTEM_PROMPT;

    if (sessionManager && sessionManager.hasActiveSession()) {
      const sessionMessages = sessionManager.getMessages();
      if (sessionMessages.length === 0) {
        const systemMsg = { role: 'system' as const, content: fullSystemPrompt };
        sessionManager.addMessage(systemMsg);
        this.messages = [systemMsg];
      } else {
        this.messages = sessionMessages;
      }
    } else {
      this.messages = [{ role: 'system' as const, content: fullSystemPrompt }];
    }
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  addBeforeToolCallback(
    callback: (toolName: string, params: Record<string, unknown>) => Promise<{ allowed: boolean; result?: ToolResult }>
  ): void {
    this.beforeToolCallbacks.push(callback);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  private isDangerousTool(toolName: string, params: Record<string, unknown>): DangerousToolInfo | null {
    // 内置危险操作检测
    if (toolName === 'GitPush' && params['force'] === true) {
      return { toolName, params, reason: 'Force push can overwrite remote history and cause permanent data loss.' };
    }

    // NOTCLAUDECODE.md 禁止规则检测
    const forbidden = this.configManager.isForbidden(toolName, params);
    if (forbidden.forbidden) {
      return { toolName, params, reason: forbidden.message || `Operation "${toolName}" is forbidden by project configuration.` };
    }

    return null;
  }

  private async executeDangerousToolCheck(
    toolName: string,
    params: Record<string, unknown>,
    dangerousCallback?: DangerousToolCallback
  ): Promise<{ allowed: boolean; result?: ToolResult }> {
    const dangerous = this.isDangerousTool(toolName, params);
    if (!dangerous) return { allowed: true };

    const callback = dangerousCallback || this.dangerousToolCallback;
    if (!callback) return { allowed: true };

    const approved = await callback(dangerous);
    if (!approved) {
      return {
        allowed: false,
        result: { success: false, error: 'Operation cancelled by user.' },
      };
    }
    return { allowed: true };
  }

  getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  async processUserMessage(userMessage: string): Promise<string> {
    const userMsg = { role: 'user' as const, content: userMessage };
    this.messages.push(userMsg);
    this.saveMessage(userMsg);

    return this.processLoop();
  }

  async *processUserMessageStream(
    userMessage: string,
    onToolCall?: (toolName: string, params: Record<string, unknown>) => void,
    dangerousToolCallback?: DangerousToolCallback
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const userMsg = { role: 'user' as const, content: userMessage };
    this.messages.push(userMsg);
    this.saveMessage(userMsg);

    yield* this.processLoopStream(onToolCall, dangerousToolCallback);
  }

  private async *processLoopStream(
    onToolCall?: (toolName: string, params: Record<string, unknown>) => void,
    dangerousToolCallback?: DangerousToolCallback
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
          const assistantMsg = {
            role: 'assistant' as const,
            content: content || null,
            tool_calls: toolCalls,
          };
          this.messages.push(assistantMsg);
          this.saveMessage(assistantMsg);

          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            const tool = this.tools.get(toolName);

            if (!tool) {
              debugLog('ERROR', `Unknown tool: ${toolName}`);
              const toolMsg = {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                name: toolName,
                content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
              };
              this.messages.push(toolMsg);
              this.saveMessage(toolMsg);
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

            // 运行所有 beforeTool 钩子
            let blockedByHook = false;
            for (const callback of this.beforeToolCallbacks) {
              try {
                const hookResult = await callback(toolName, params);
                if (!hookResult.allowed) {
                  const toolMsg = {
                    role: 'tool' as const,
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: JSON.stringify(hookResult.result || { success: false, error: 'Operation blocked by hook.' }),
                  };
                  this.messages.push(toolMsg);
                  this.saveMessage(toolMsg);
                  blockedByHook = true;
                  break;
                }
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                debugLog('HOOK_ERROR', `beforeTool callback error: ${errorMsg}`);
              }
            }

            if (blockedByHook) {
              continue;
            }

            // 危险操作拦截（dangerousToolCallback）
            const dangerousCallback = dangerousToolCallback || this.dangerousToolCallback;
            if (dangerousCallback) {
              const dangerous = this.isDangerousTool(toolName, params);
              if (dangerous) {
                const approved = await dangerousCallback(dangerous);
                if (!approved) {
                  const toolMsg = {
                    role: 'tool' as const,
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: JSON.stringify({ success: false, error: 'Operation cancelled by user.' }),
                  };
                  this.messages.push(toolMsg);
                  this.saveMessage(toolMsg);
                  continue;
                }
              }
            }

            const result = await tool.execute(params);
            debugLog('TOOL_RESULT', `Tool result for ${toolName}`, { 
              success: result.success,
              outputLength: result.output?.length 
            });

            const toolMsg = {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result),
            };
            this.messages.push(toolMsg);
            this.saveMessage(toolMsg);
          }

          const compactCheck = this.contextMonitor.shouldTriggerCompact(this.messages);
          if (compactCheck.shouldTrigger && compactCheck.layer >= 1) {
            const compactResult = await this.executeAutoCompact(compactCheck.layer);
            if (compactResult.triggered) {
              yield {
                type: 'content',
                content: createCompactNotificationStream(compactResult),
              };
            }
          }

          yield* this.processLoopStream(onToolCall, dangerousToolCallback);
          return;
        }

        const finalMsg = {
          role: 'assistant' as const,
          content: content || null,
        };
        this.messages.push(finalMsg);
        this.saveMessage(finalMsg);
        this.saveSession();

        const compactCheck = this.contextMonitor.shouldTriggerCompact(this.messages);
        if (compactCheck.shouldTrigger && compactCheck.layer >= 2) {
          const compactResult = await this.executeAutoCompact(compactCheck.layer);
          if (compactResult.triggered) {
            yield {
              type: 'content',
              content: createCompactNotificationStream(compactResult),
            };
          }
        }

        yield { type: 'done', finishReason: chunk.finishReason };
      }
    }
  }

  private async processLoop(): Promise<string> {
    const toolDefs = this.getToolDefinitions();
    let response = await this.provider.chat(this.messages, toolDefs);

    while (response.toolCalls.length > 0) {
      const assistantMsg = {
        role: 'assistant' as const,
        content: response.content,
        tool_calls: response.toolCalls,
      };
      this.messages.push(assistantMsg);
      this.saveMessage(assistantMsg);

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          const toolMsg = {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
          };
          this.messages.push(toolMsg);
          this.saveMessage(toolMsg);
          continue;
        }

        let params: Record<string, unknown>;
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          params = {};
        }

        const result = await tool.execute(params);

        const toolMsg = {
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result),
        };
        this.messages.push(toolMsg);
        this.saveMessage(toolMsg);
      }

      const compactCheck = this.contextMonitor.shouldTriggerCompact(this.messages);
      if (compactCheck.shouldTrigger && compactCheck.layer >= 1) {
        await this.executeAutoCompact(compactCheck.layer);
      }

      response = await this.provider.chat(this.messages, toolDefs);
    }

    const finalMsg = {
      role: 'assistant' as const,
      content: response.content,
    };
    this.messages.push(finalMsg);
    this.saveMessage(finalMsg);
    this.saveSession();

    const compactCheck = this.contextMonitor.shouldTriggerCompact(this.messages);
    if (compactCheck.shouldTrigger && compactCheck.layer >= 2) {
      await this.executeAutoCompact(compactCheck.layer);
    }

    return response.content || 'Done.';
  }

  private saveMessage(message: Message): void {
    if (this.autoSave && this.sessionManager) {
      this.sessionManager.appendMessageToStorage(message);
    }
  }

  private saveSession(): void {
    if (this.autoSave && this.sessionManager) {
      this.sessionManager.setMessages([...this.messages]);
      this.sessionManager.saveSession();
    }
  }

  getConversationHistory(): Message[] {
    return [...this.messages];
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  clearHistory(): void {
    const systemMsg = {
      role: 'system' as const,
      content: SYSTEM_PROMPT,
    };
    this.messages = [systemMsg];
    if (this.sessionManager) {
      this.sessionManager.setMessages([systemMsg]);
      this.sessionManager.saveSession();
    }
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
      const tokens = countMessageTokens(msg);
      const chars = content.length;

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
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

  getTokenCount(): number {
    return countMessagesTokens(this.messages);
  }

  getContextLimit(): number {
    if (this.sessionManager) {
      return this.sessionManager.getContextLimit();
    }
    return 128000;
  }

  getContextUsagePercent(): number {
    const limit = this.getContextLimit();
    const current = this.getTokenCount();
    return Math.round((current / limit) * 100);
  }

  createCheckpoint(description?: string): void {
    if (this.sessionManager) {
      this.sessionManager.createCheckpoint(description, 'manual');
    }
  }

  getCheckpoints() {
    return this.sessionManager?.getCheckpoints() || [];
  }

  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    if (!this.sessionManager) {
      return false;
    }
    const success = await this.sessionManager.restoreCheckpoint(checkpointId);
    if (success) {
      this.messages = this.sessionManager.getMessages();
    }
    return success;
  }

  setMessages(messages: Message[]): void {
    this.messages = messages;
    if (this.sessionManager) {
      this.sessionManager.setMessages(messages);
    }
  }

  checkAndAutoCompact(): { triggered: boolean; reason?: string } {
    const contextLimit = this.getContextLimit();
    const usagePercent = this.getContextUsagePercent() / 100;

    if (usagePercent < 0.7) {
      return { triggered: false };
    }

    if (usagePercent >= 0.7 && shouldTriggerToolResultCleanup(this.messages, contextLimit, 0.7)) {
      const result = toolResultCleanup(this.messages, contextLimit, 0.6);
      
      if (result.triggered) {
        this.messages = result.messages;
        if (this.sessionManager) {
          this.sessionManager.setMessages(result.messages);
        }
        
        debugLog('COMPACT', `Layer 1 compact triggered`, {
          tokensSaved: result.tokensBefore - result.tokensAfter,
          toolResultsCleaned: result.toolResultsCleaned,
        });

        return { 
          triggered: true, 
          reason: `Layer 1 compact: cleaned ${result.toolResultsCleaned} tool results` 
        };
      }
    }

    if (usagePercent >= 0.85 && usagePercent < 0.95 && this.sessionManager) {
      const memory = this.sessionManager.getSessionMemory();
      const result = layer2Compact(this.messages, contextLimit, memory);
      
      this.messages = result.messages;
      this.sessionManager.setMessages(result.messages);
      this.sessionManager.setSessionMemory(result.memory);
      
      debugLog('COMPACT', `Layer 2 compact triggered`, {
        tokensSaved: result.tokensSaved,
        messagesSummarized: result.messagesSummarized,
      });

      return { 
        triggered: true, 
        reason: `Layer 2 compact: saved ${result.tokensSaved} tokens, summarized ${result.messagesSummarized} messages` 
      };
    }

    return { triggered: false };
  }

  async checkAndAutoCompactAsync(): Promise<{ triggered: boolean; reason?: string }> {
    const contextLimit = this.getContextLimit();
    const usagePercent = this.getContextUsagePercent() / 100;

    if (usagePercent < 0.7) {
      return { triggered: false };
    }

    if (usagePercent >= 0.95) {
      const result = await layer3Compact(this.messages, this.provider, contextLimit, 5);
      
      if (result.tokensSaved > 0) {
        this.messages = result.messages;
        if (this.sessionManager) {
          this.sessionManager.setMessages(result.messages);
        }
        
        debugLog('COMPACT', `Layer 3 compact triggered`, {
          tokensSaved: result.tokensSaved,
          messagesSummarized: result.messagesSummarized,
        });

        return { 
          triggered: true, 
          reason: `Layer 3 compact: saved ${result.tokensSaved} tokens, summarized ${result.messagesSummarized} messages` 
        };
      }
    }

    if (usagePercent >= 0.85 && this.sessionManager) {
      const memory = this.sessionManager.getSessionMemory();
      const result = layer2Compact(this.messages, contextLimit, memory);
      
      this.messages = result.messages;
      this.sessionManager.setMessages(result.messages);
      this.sessionManager.setSessionMemory(result.memory);
      
      debugLog('COMPACT', `Layer 2 compact triggered`, {
        tokensSaved: result.tokensSaved,
        messagesSummarized: result.messagesSummarized,
      });

      return { 
        triggered: true, 
        reason: `Layer 2 compact: saved ${result.tokensSaved} tokens, summarized ${result.messagesSummarized} messages` 
      };
    }

    if (usagePercent >= 0.7 && shouldTriggerToolResultCleanup(this.messages, contextLimit, 0.7)) {
      const result = toolResultCleanup(this.messages, contextLimit, 0.6);
      
      if (result.triggered) {
        this.messages = result.messages;
        if (this.sessionManager) {
          this.sessionManager.setMessages(result.messages);
        }
        
        debugLog('COMPACT', `Layer 1 compact triggered`, {
          tokensSaved: result.tokensBefore - result.tokensAfter,
          toolResultsCleaned: result.toolResultsCleaned,
        });

        return { 
          triggered: true, 
          reason: `Layer 1 compact: cleaned ${result.toolResultsCleaned} tool results` 
        };
      }
    }

    return { triggered: false };
  }

  private async executeAutoCompact(layer: 0 | 1 | 2 | 3): Promise<CompactTriggerResult> {
    if (layer === 0) {
      return {
        triggered: false,
        layer: 0,
        tokensBefore: countMessagesTokens(this.messages),
        tokensAfter: countMessagesTokens(this.messages),
        tokensSaved: 0,
        reason: 'No compression needed',
        messages: this.messages,
      };
    }

    const existingMemory = this.sessionManager?.getSessionMemory();
    const result = await this.contextMonitor.executeCompact(
      this.messages,
      layer,
      this.provider,
      existingMemory
    );

    if (result.triggered) {
      this.messages = result.messages;
      
      if (this.sessionManager) {
        this.sessionManager.setMessages(result.messages);
        
        if (result.memory) {
          this.sessionManager.setSessionMemory(result.memory);
        }
        
        this.sessionManager.saveSession();
      }

      debugLog('AUTO_COMPACT', `Auto compact executed`, {
        layer: result.layer,
        tokensSaved: result.tokensSaved,
        reason: result.reason,
      });
    }

    return result;
  }

  getContextMonitor(): ContextMonitor {
    return this.contextMonitor;
  }

  getSkillManager(): SkillManager {
    return this.skillManager;
  }
}
