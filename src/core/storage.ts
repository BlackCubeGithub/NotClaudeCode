import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionMetadata,
  SessionIndex,
  SessionIndexEntry,
  Checkpoint,
  SessionMemory,
  Message,
  DEFAULT_SESSION_MEMORY,
} from '../types';

const STORAGE_DIR = '.notclaudecode';
const SESSIONS_DIR = 'sessions';
const INDEX_FILE = 'index.json';

export class Storage {
  private storagePath: string;
  private sessionsPath: string;

  constructor(customPath?: string) {
    this.storagePath = customPath || path.join(os.homedir(), STORAGE_DIR);
    this.sessionsPath = path.join(this.storagePath, SESSIONS_DIR);
    this.ensureStorageExists();
  }

  private ensureStorageExists(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
    const indexPath = path.join(this.storagePath, INDEX_FILE);
    if (!fs.existsSync(indexPath)) {
      this.saveIndex({ sessions: [] });
    }
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  loadIndex(): SessionIndex {
    const indexPath = path.join(this.storagePath, INDEX_FILE);
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { sessions: [] };
    }
  }

  saveIndex(index: SessionIndex): void {
    const indexPath = path.join(this.storagePath, INDEX_FILE);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  addToIndex(metadata: SessionMetadata): void {
    const index = this.loadIndex();
    const entry: SessionIndexEntry = {
      id: metadata.id,
      title: metadata.title,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      workingDirectory: metadata.workingDirectory,
      messageCount: metadata.messageCount,
      tokenCount: metadata.tokenCount,
    };
    const existingIndex = index.sessions.findIndex((s) => s.id === metadata.id);
    if (existingIndex >= 0) {
      index.sessions[existingIndex] = entry;
    } else {
      index.sessions.unshift(entry);
    }
    index.sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    index.lastActiveSession = metadata.id;
    this.saveIndex(index);
  }

  removeFromIndex(sessionId: string): void {
    const index = this.loadIndex();
    index.sessions = index.sessions.filter((s) => s.id !== sessionId);
    if (index.lastActiveSession === sessionId) {
      index.lastActiveSession = index.sessions[0]?.id;
    }
    this.saveIndex(index);
  }

  createSession(
    provider: string,
    model: string,
    workingDirectory: string,
    title?: string
  ): SessionMetadata {
    const id = uuidv4();
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      id,
      title: title || undefined,
      createdAt: now,
      updatedAt: now,
      provider,
      model,
      workingDirectory,
      tokenCount: 0,
      messageCount: 0,
      status: 'active',
    };
    const sessionPath = this.getSessionPath(id);
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.mkdirSync(path.join(sessionPath, 'checkpoints'), { recursive: true });
    this.saveMetadata(metadata);
    this.saveMessages(id, []);
    this.saveSessionMemory(id, DEFAULT_SESSION_MEMORY);
    this.addToIndex(metadata);
    return metadata;
  }

  getSessionPath(sessionId: string): string {
    return path.join(this.sessionsPath, sessionId);
  }

  loadMetadata(sessionId: string): SessionMetadata | null {
    const metadataPath = path.join(this.getSessionPath(sessionId), 'metadata.json');
    try {
      const content = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  saveMetadata(metadata: SessionMetadata): void {
    const metadataPath = path.join(this.getSessionPath(metadata.id), 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  loadMessages(sessionId: string): Message[] {
    const messagesPath = path.join(this.getSessionPath(sessionId), 'messages.jsonl');
    try {
      if (!fs.existsSync(messagesPath)) {
        return [];
      }
      const content = fs.readFileSync(messagesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  saveMessages(sessionId: string, messages: Message[]): void {
    const messagesPath = path.join(this.getSessionPath(sessionId), 'messages.jsonl');
    if (messages.length === 0) {
      fs.writeFileSync(messagesPath, '', 'utf-8');
    } else {
      const content = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
      fs.writeFileSync(messagesPath, content, 'utf-8');
    }
  }

  appendMessage(sessionId: string, message: Message): void {
    const messagesPath = path.join(this.getSessionPath(sessionId), 'messages.jsonl');
    const line = JSON.stringify(message) + '\n';
    fs.appendFileSync(messagesPath, line, 'utf-8');
  }

  loadSessionMemory(sessionId: string): SessionMemory {
    const memoryPath = path.join(this.getSessionPath(sessionId), 'session_memory.json');
    try {
      const content = fs.readFileSync(memoryPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return DEFAULT_SESSION_MEMORY;
    }
  }

  saveSessionMemory(sessionId: string, memory: SessionMemory): void {
    const memoryPath = path.join(this.getSessionPath(sessionId), 'session_memory.json');
    memory.lastUpdated = new Date().toISOString();
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
  }

  loadSessionMemoryMarkdown(sessionId: string): string {
    const memoryPath = path.join(this.getSessionPath(sessionId), 'session_memory.md');
    try {
      return fs.readFileSync(memoryPath, 'utf-8');
    } catch {
      return this.generateMemoryMarkdown(DEFAULT_SESSION_MEMORY);
    }
  }

  saveSessionMemoryMarkdown(sessionId: string, markdown: string): void {
    const memoryPath = path.join(this.getSessionPath(sessionId), 'session_memory.md');
    fs.writeFileSync(memoryPath, markdown, 'utf-8');
  }

  generateMemoryMarkdown(memory: SessionMemory): string {
    let md = '# Session Memory\n\n';
    md += '## 项目概要\n';
    md += memory.projectOverview || '_暂无信息_\n';
    md += '\n## 已完成的任务\n';
    if (memory.completedTasks.length > 0) {
      memory.completedTasks.forEach((task) => {
        md += `- ${task}\n`;
      });
    } else {
      md += '_暂无_\n';
    }
    md += '\n## 关键决策\n';
    if (memory.keyDecisions.length > 0) {
      memory.keyDecisions.forEach((decision) => {
        md += `- ${decision}\n`;
      });
    } else {
      md += '_暂无_\n';
    }
    md += '\n## 当前状态\n';
    md += memory.currentState || '_暂无信息_\n';
    md += '\n## 重要文件\n';
    if (memory.importantFiles.length > 0) {
      memory.importantFiles.forEach((file) => {
        md += `- ${file}\n`;
      });
    } else {
      md += '_暂无_\n';
    }
    md += '\n## 遇到的问题与解决方案\n';
    if (memory.problemsAndSolutions.length > 0) {
      memory.problemsAndSolutions.forEach((item) => {
        md += `- ${item}\n`;
      });
    } else {
      md += '_暂无_\n';
    }
    md += `\n---\n最后更新: ${memory.lastUpdated}\n`;
    return md;
  }

  loadCheckpoints(sessionId: string): Checkpoint[] {
    const checkpointsPath = path.join(this.getSessionPath(sessionId), 'checkpoints');
    try {
      const files = fs.readdirSync(checkpointsPath).filter((f) => f.endsWith('.json') && !f.includes('_messages'));
      const checkpoints: Checkpoint[] = files
        .map((f) => {
          try {
            const content = fs.readFileSync(path.join(checkpointsPath, f), 'utf-8');
            return JSON.parse(content);
          } catch {
            return null;
          }
        })
        .filter((cp): cp is Checkpoint => cp !== null && cp.id !== undefined);
      return checkpoints.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch {
      return [];
    }
  }

  saveCheckpoint(
    sessionId: string,
    checkpoint: Checkpoint,
    messages: Message[]
  ): void {
    const checkpointsPath = path.join(this.getSessionPath(sessionId), 'checkpoints');
    const checkpointFile = path.join(checkpointsPath, `${checkpoint.id}.json`);
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf-8');
    const messagesFile = path.join(checkpointsPath, `${checkpoint.id}_messages.json`);
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2), 'utf-8');
  }

  loadCheckpointMessages(sessionId: string, checkpointId: string): Message[] {
    const messagesFile = path.join(
      this.getSessionPath(sessionId),
      'checkpoints',
      `${checkpointId}_messages.json`
    );
    try {
      const content = fs.readFileSync(messagesFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  deleteCheckpoint(sessionId: string, checkpointId: string): void {
    const checkpointsPath = path.join(this.getSessionPath(sessionId), 'checkpoints');
    const checkpointFile = path.join(checkpointsPath, `${checkpointId}.json`);
    const messagesFile = path.join(checkpointsPath, `${checkpointId}_messages.json`);
    if (fs.existsSync(checkpointFile)) {
      fs.unlinkSync(checkpointFile);
    }
    if (fs.existsSync(messagesFile)) {
      fs.unlinkSync(messagesFile);
    }
  }

  deleteSession(sessionId: string): void {
    const sessionPath = this.getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    this.removeFromIndex(sessionId);
  }

  sessionExists(sessionId: string): boolean {
    return fs.existsSync(this.getSessionPath(sessionId));
  }

  listSessions(): SessionIndexEntry[] {
    return this.loadIndex().sessions;
  }

  getLastActiveSession(): string | undefined {
    return this.loadIndex().lastActiveSession;
  }
}

export const storage = new Storage();
