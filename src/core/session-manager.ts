import { v4 as uuidv4 } from 'uuid';
import {
  SessionMetadata,
  SessionIndexEntry,
  Checkpoint,
  SessionMemory,
  Message,
  CompactConfig,
  DEFAULT_COMPACT_CONFIG,
  DEFAULT_SESSION_MEMORY,
} from '../types';
import { Storage } from './storage';
import {
  countMessagesTokens,
  getToolResultCount,
  getModelContextLimit,
} from '../utils/token-counter';

export class SessionManager {
  private currentSessionId: string | null = null;
  private metadata: SessionMetadata | null = null;
  private messages: Message[] = [];
  private sessionMemory: SessionMemory;
  private checkpoints: Checkpoint[] = [];
  private config: CompactConfig;

  constructor(
    private storage: Storage,
    config?: Partial<CompactConfig>
  ) {
    this.config = { ...DEFAULT_COMPACT_CONFIG, ...config };
    this.sessionMemory = { ...DEFAULT_SESSION_MEMORY };
  }

  async createSession(
    provider: string,
    model: string,
    workingDirectory: string,
    title?: string
  ): Promise<string> {
    this.metadata = this.storage.createSession(provider, model, workingDirectory, title || undefined);
    this.currentSessionId = this.metadata.id;
    this.messages = [];
    this.sessionMemory = { ...DEFAULT_SESSION_MEMORY };
    this.checkpoints = [];
    return this.currentSessionId;
  }

  async loadSession(sessionId: string): Promise<boolean> {
    if (!this.storage.sessionExists(sessionId)) {
      return false;
    }
    this.currentSessionId = sessionId;
    this.metadata = this.storage.loadMetadata(sessionId);
    if (!this.metadata) {
      return false;
    }
    this.messages = this.storage.loadMessages(sessionId);
    this.sessionMemory = this.storage.loadSessionMemory(sessionId);
    this.checkpoints = this.storage.loadCheckpoints(sessionId);
    return true;
  }

  async saveSession(): Promise<void> {
    if (!this.currentSessionId || !this.metadata) {
      return;
    }
    this.metadata.updatedAt = new Date().toISOString();
    this.metadata.messageCount = this.messages.length;
    this.metadata.tokenCount = countMessagesTokens(this.messages);
    this.storage.saveMetadata(this.metadata);
    this.storage.saveMessages(this.currentSessionId, this.messages);
    this.storage.addToIndex(this.metadata);
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getMetadata(): SessionMetadata | null {
    return this.metadata;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  setMessages(messages: Message[]): void {
    this.messages = messages;
  }

  addMessage(message: Message): void {
    this.messages.push(message);
    if (this.currentSessionId) {
      this.storage.appendMessage(this.currentSessionId, message);
    }
  }

  appendMessageToStorage(message: Message): void {
    if (this.currentSessionId) {
      this.storage.appendMessage(this.currentSessionId, message);
    }
  }

  getSessionMemory(): SessionMemory {
    return this.sessionMemory;
  }

  setSessionMemory(memory: SessionMemory): void {
    this.sessionMemory = memory;
    if (this.currentSessionId) {
      this.storage.saveSessionMemory(this.currentSessionId, this.sessionMemory);
    }
  }

  updateSessionMemory(memory: Partial<SessionMemory>): void {
    this.sessionMemory = { ...this.sessionMemory, ...memory };
    if (this.currentSessionId) {
      this.storage.saveSessionMemory(this.currentSessionId, this.sessionMemory);
    }
  }

  getTokenCount(): number {
    return countMessagesTokens(this.messages);
  }

  getContextLimit(): number {
    if (!this.metadata) {
      return 128000;
    }
    return getModelContextLimit(this.metadata.model);
  }

  getContextUsagePercent(): number {
    const limit = this.getContextLimit();
    const current = this.getTokenCount();
    return Math.round((current / limit) * 100);
  }

  shouldTriggerToolResultCleanup(): boolean {
    const toolResultCount = getToolResultCount(this.messages);
    return toolResultCount >= this.config.toolResultThreshold;
  }

  shouldTriggerSessionMemoryCompact(): boolean {
    const usage = this.getContextUsagePercent();
    return usage >= this.config.sessionMemoryThreshold * 100;
  }

  shouldTriggerFullCompact(): boolean {
    const usage = this.getContextUsagePercent();
    return usage >= this.config.fullCompactThreshold * 100;
  }

  createCheckpoint(
    description?: string,
    type: 'auto' | 'manual' | 'before_compact' = 'manual'
  ): Checkpoint | null {
    if (!this.currentSessionId) {
      return null;
    }
    const checkpoint: Checkpoint = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      messageIndex: this.messages.length,
      description,
      tokenCount: this.getTokenCount(),
      type,
    };
    this.storage.saveCheckpoint(this.currentSessionId, checkpoint, this.messages);
    this.checkpoints.unshift(checkpoint);
    return checkpoint;
  }

  getCheckpoints(): Checkpoint[] {
    return this.checkpoints;
  }

  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    if (!this.currentSessionId) {
      return false;
    }
    const messages = this.storage.loadCheckpointMessages(
      this.currentSessionId,
      checkpointId
    );
    if (messages.length === 0) {
      return false;
    }
    this.messages = messages;
    await this.saveSession();
    return true;
  }

  deleteCheckpoint(checkpointId: string): void {
    if (!this.currentSessionId) {
      return;
    }
    this.storage.deleteCheckpoint(this.currentSessionId, checkpointId);
    this.checkpoints = this.checkpoints.filter((c) => c.id !== checkpointId);
  }

  listSessions(): SessionIndexEntry[] {
    return this.storage.listSessions();
  }

  async deleteSession(sessionId?: string): Promise<void> {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      return;
    }
    this.storage.deleteSession(id);
    if (id === this.currentSessionId) {
      this.currentSessionId = null;
      this.metadata = null;
      this.messages = [];
      this.sessionMemory = { ...DEFAULT_SESSION_MEMORY };
      this.checkpoints = [];
    }
  }

  async archiveSession(): Promise<void> {
    if (!this.metadata) {
      return;
    }
    this.metadata.status = 'archived';
    await this.saveSession();
  }

  setTitle(title: string): void {
    if (this.metadata) {
      this.metadata.title = title;
    }
  }

  clearMessages(): void {
    this.messages = [];
    if (this.currentSessionId) {
      this.storage.saveMessages(this.currentSessionId, []);
    }
  }

  hasActiveSession(): boolean {
    return this.currentSessionId !== null && this.metadata !== null;
  }

  getStats(): {
    messageCount: number;
    tokenCount: number;
    contextLimit: number;
    usagePercent: number;
    toolResultCount: number;
    checkpointCount: number;
  } {
    return {
      messageCount: this.messages.length,
      tokenCount: this.getTokenCount(),
      contextLimit: this.getContextLimit(),
      usagePercent: this.getContextUsagePercent(),
      toolResultCount: getToolResultCount(this.messages),
      checkpointCount: this.checkpoints.length,
    };
  }
}
