import { Message } from './index';

export interface SessionMetadata {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  workingDirectory: string;
  title?: string;
  tokenCount: number;
  messageCount: number;
  status: 'active' | 'archived';
  tags?: string[];
}

export interface SessionIndex {
  sessions: SessionIndexEntry[];
  lastActiveSession?: string;
}

export interface SessionIndexEntry {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  workingDirectory: string;
  messageCount: number;
  tokenCount: number;
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  messageIndex: number;
  description?: string;
  tokenCount: number;
  type: 'auto' | 'manual' | 'before_compact';
}

export interface SessionMemory {
  projectOverview: string;
  completedTasks: string[];
  keyDecisions: string[];
  currentState: string;
  importantFiles: string[];
  problemsAndSolutions: string[];
  lastUpdated: string;
}

export interface CompactConfig {
  toolResultThreshold: number;
  toolResultKeepRecent: number;
  sessionMemoryThreshold: number;
  fullCompactThreshold: number;
  minTokensToKeep: number;
  minMessagesToKeep: number;
}

export const DEFAULT_COMPACT_CONFIG: CompactConfig = {
  toolResultThreshold: 15,
  toolResultKeepRecent: 5,
  sessionMemoryThreshold: 0.8,
  fullCompactThreshold: 0.95,
  minTokensToKeep: 10000,
  minMessagesToKeep: 10,
};

export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
  checkpoints: Checkpoint[];
  sessionMemory?: SessionMemory;
}

export const DEFAULT_SESSION_MEMORY: SessionMemory = {
  projectOverview: '',
  completedTasks: [],
  keyDecisions: [],
  currentState: '',
  importantFiles: [],
  problemsAndSolutions: [],
  lastUpdated: new Date().toISOString(),
};
