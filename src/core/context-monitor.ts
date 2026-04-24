import { Message, AIProvider, SessionMemory, DEFAULT_COMPACT_CONFIG } from '../types';
import { countMessagesTokens, getContextUsageStats } from '../utils/token-counter';
import {
  toolResultCleanup,
} from './compact';
import {
  layer2Compact,
  layer3Compact,
} from './memory';

export interface CompactTriggerResult {
  triggered: boolean;
  layer: 0 | 1 | 2 | 3;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  reason: string;
  messages: Message[];
  memory?: SessionMemory;
}

export interface ContextMonitorConfig {
  contextLimit: number;
  layer1Threshold: number;
  layer2Threshold: number;
  layer3Threshold: number;
  enableAutoCompact: boolean;
  showCompactNotification: boolean;
}

export const DEFAULT_CONTEXT_MONITOR_CONFIG: ContextMonitorConfig = {
  contextLimit: 128000,
  layer1Threshold: 0.70,
  layer2Threshold: 0.85,
  layer3Threshold: 0.95,
  enableAutoCompact: true,
  showCompactNotification: true,
};

export class ContextMonitor {
  private config: ContextMonitorConfig;
  private lastCompactTime: number = 0;
  private compactCooldown: number = 5000;
  private compactCount: number = 0;

  constructor(config: Partial<ContextMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_MONITOR_CONFIG, ...config };
  }

  setContextLimit(limit: number): void {
    this.config.contextLimit = limit;
  }

  getContextLimit(): number {
    return this.config.contextLimit;
  }

  getContextUsage(messages: Message[]): {
    totalTokens: number;
    usagePercent: number;
    layer: 0 | 1 | 2 | 3;
  } {
    const stats = getContextUsageStats(messages, this.config.contextLimit);
    const usagePercent = stats.usagePercent / 100;

    let layer: 0 | 1 | 2 | 3 = 0;
    if (usagePercent >= this.config.layer3Threshold) {
      layer = 3;
    } else if (usagePercent >= this.config.layer2Threshold) {
      layer = 2;
    } else if (usagePercent >= this.config.layer1Threshold) {
      layer = 1;
    }

    return {
      totalTokens: stats.totalTokens,
      usagePercent,
      layer,
    };
  }

  shouldTriggerCompact(messages: Message[]): {
    shouldTrigger: boolean;
    layer: 0 | 1 | 2 | 3;
    reason: string;
  } {
    if (!this.config.enableAutoCompact) {
      return { shouldTrigger: false, layer: 0, reason: 'Auto compact disabled' };
    }

    const now = Date.now();
    if (now - this.lastCompactTime < this.compactCooldown) {
      return { shouldTrigger: false, layer: 0, reason: 'Compact on cooldown' };
    }

    const usage = this.getContextUsage(messages);

    if (usage.layer === 3) {
      return {
        shouldTrigger: true,
        layer: 3,
        reason: `Critical: Context usage at ${(usage.usagePercent * 100).toFixed(1)}% (Layer 3 threshold: ${this.config.layer3Threshold * 100}%)`,
      };
    }

    if (usage.layer === 2) {
      return {
        shouldTrigger: true,
        layer: 2,
        reason: `High: Context usage at ${(usage.usagePercent * 100).toFixed(1)}% (Layer 2 threshold: ${this.config.layer2Threshold * 100}%)`,
      };
    }

    if (usage.layer === 1) {
      return {
        shouldTrigger: true,
        layer: 1,
        reason: `Moderate: Context usage at ${(usage.usagePercent * 100).toFixed(1)}% (Layer 1 threshold: ${this.config.layer1Threshold * 100}%)`,
      };
    }

    return {
      shouldTrigger: false,
      layer: 0,
      reason: `Context usage healthy at ${(usage.usagePercent * 100).toFixed(1)}%`,
    };
  }

  async executeCompact(
    messages: Message[],
    layer: 1 | 2 | 3,
    provider?: AIProvider,
    existingMemory?: SessionMemory
  ): Promise<CompactTriggerResult> {
    const tokensBefore = countMessagesTokens(messages);
    let result: CompactTriggerResult;

    try {
      switch (layer) {
        case 1:
          result = await this.executeLayer1(messages);
          break;
        case 2:
          result = await this.executeLayer2(messages, existingMemory);
          break;
        case 3:
          if (!provider) {
            result = {
              triggered: false,
              layer: 0,
              tokensBefore,
              tokensAfter: tokensBefore,
              tokensSaved: 0,
              reason: 'Layer 3 requires AI provider',
              messages,
            };
          } else {
            result = await this.executeLayer3(messages, provider);
          }
          break;
        default:
          result = {
            triggered: false,
            layer: 0,
            tokensBefore,
            tokensAfter: tokensBefore,
            tokensSaved: 0,
            reason: 'Invalid layer',
            messages,
          };
      }

      if (result.triggered) {
        this.lastCompactTime = Date.now();
        this.compactCount++;
      }

      return result;
    } catch (error) {
      console.error('Compact execution failed:', error);
      return {
        triggered: false,
        layer: 0,
        tokensBefore,
        tokensAfter: tokensBefore,
        tokensSaved: 0,
        reason: `Compact failed: ${error instanceof Error ? error.message : String(error)}`,
        messages,
      };
    }
  }

  private async executeLayer1(messages: Message[]): Promise<CompactTriggerResult> {
    const tokensBefore = countMessagesTokens(messages);
    const result = toolResultCleanup(
      messages,
      this.config.contextLimit,
      0.65,
      DEFAULT_COMPACT_CONFIG
    );

    return {
      triggered: result.triggered,
      layer: 1,
      tokensBefore,
      tokensAfter: result.tokensAfter,
      tokensSaved: tokensBefore - result.tokensAfter,
      reason: result.reason || 'Layer 1: Tool result cleanup',
      messages: result.messages,
    };
  }

  private async executeLayer2(
    messages: Message[],
    existingMemory?: SessionMemory
  ): Promise<CompactTriggerResult> {
    const tokensBefore = countMessagesTokens(messages);
    const result = layer2Compact(messages, this.config.contextLimit, existingMemory);

    return {
      triggered: true,
      layer: 2,
      tokensBefore,
      tokensAfter: countMessagesTokens(result.messages),
      tokensSaved: result.tokensSaved,
      reason: `Layer 2: Session memory compression. Summarized ${result.messagesSummarized} messages.`,
      messages: result.messages,
      memory: result.memory,
    };
  }

  private async executeLayer3(
    messages: Message[],
    provider: AIProvider
  ): Promise<CompactTriggerResult> {
    const tokensBefore = countMessagesTokens(messages);
    const result = await layer3Compact(messages, provider, this.config.contextLimit, 5);

    return {
      triggered: true,
      layer: 3,
      tokensBefore,
      tokensAfter: countMessagesTokens(result.messages),
      tokensSaved: result.tokensSaved,
      reason: `Layer 3: AI summary compression. Summarized ${result.messagesSummarized} messages.`,
      messages: result.messages,
    };
  }

  getCompactStats(): {
    compactCount: number;
    lastCompactTime: number;
    config: ContextMonitorConfig;
  } {
    return {
      compactCount: this.compactCount,
      lastCompactTime: this.lastCompactTime,
      config: this.config,
    };
  }

  formatCompactNotification(result: CompactTriggerResult): string {
    if (!this.config.showCompactNotification) {
      return '';
    }

    const lines: string[] = [];
    lines.push('🔄 **Auto-Compact Triggered**');
    lines.push('');
    lines.push(`**Layer**: ${result.layer}`);
    lines.push(`**Reason**: ${result.reason}`);
    lines.push(`**Tokens**: ${result.tokensBefore} → ${result.tokensAfter} (saved ${result.tokensSaved})`);
    lines.push('');

    return lines.join('\n');
  }
}

export function createCompactNotificationStream(result: CompactTriggerResult): string {
  const lines: string[] = [];
  lines.push('\n---\n');
  lines.push('🔄 **Context Auto-Compacted**');
  lines.push(`- **Layer**: ${result.layer}`);
  lines.push(`- **Tokens Saved**: ${result.tokensSaved}`);
  lines.push(`- **Usage**: ${result.tokensBefore} → ${result.tokensAfter}`);
  lines.push('---\n');
  return lines.join('\n');
}
