/**
 * CLAUDE.md 配置管理器
 *
 * 职责：
 * 1. 加载多层级配置文件（全局 / 项目 / 本地）
 * 2. 解析 CLAUDE.md Markdown 格式
 * 3. 合并 JSON 配置与 Markdown 配置
 * 4. 将配置转换为系统提示词片段
 *
 * 加载优先级（从低到高）：
 *   全局配置  <  项目配置  <  本地覆盖
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeConfig,
  ConfigLoadResult,
  ConfigSource,
  CheckConfig,
} from '../types/config';

const GLOBAL_CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.notclaudecode'
);
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');

const PROJECT_CONFIG_FILES = ['CLAUDE.md', '.claude.json', '.claude.local.json'];

export class ConfigManager {
  private config: ClaudeConfig = {};
  private sources: ConfigSource[] = [];
  private lastLoaded = 0;
  private errors: string[] = [];

  constructor(private cwd: string = process.cwd()) {}

  // ─────────────────────────────────────────────
  // 公开 API
  // ─────────────────────────────────────────────

  /**
   * 加载并合并所有层级的配置
   */
  load(): ConfigLoadResult {
    this.config = {};
    this.sources = [];
    this.errors = [];

    // 1. 全局配置（最低优先级）
    this.loadGlobalConfig();

    // 2. 项目级配置（CLAUDE.md 优先于 .claude.json）
    this.loadProjectConfig();

    // 3. 本地覆盖（最高优先级）
    this.loadLocalConfig();

    this.lastLoaded = Date.now();

    return {
      config: { ...this.config },
      sources: [...this.sources],
      merged: this.sources.length > 1,
      errors: [...this.errors],
    };
  }

  /**
   * 重新加载配置（热重载）
   */
  reload(): ConfigLoadResult {
    return this.load();
  }

  /**
   * 获取当前配置
   */
  getConfig(): ClaudeConfig {
    return { ...this.config };
  }

  /**
   * 获取所有配置来源
   */
  getSources(): ConfigSource[] {
    return [...this.sources];
  }

  /**
   * 获取项目根目录
   */
  getProjectRoot(): string | undefined {
    return this.config.projectRoot;
  }

  /**
   * 生成注入到 system prompt 的配置文本
   */
  toSystemPrompt(): string {
    const lines: string[] = [];

    if (this.config.overview) {
      lines.push('## Project Overview');
      lines.push(this.config.overview);
      lines.push('');
    }

    if (this.config.languages && this.config.languages.length > 0) {
      lines.push('## Languages');
      lines.push(...this.config.languages.map((l) => `- ${l}`));
      lines.push('');
    }

    if (this.config.codeStyle) {
      lines.push('## Code Style');
      lines.push(this.config.codeStyle);
      lines.push('');
    }

    if (this.config.commands && Object.keys(this.config.commands).length > 0) {
      lines.push('## Available Commands');
      for (const [alias, cmd] of Object.entries(this.config.commands)) {
        lines.push(`- ${alias}: ${cmd}`);
      }
      lines.push('');
    }

    if (this.config.rules && this.config.rules.length > 0) {
      lines.push('## Project Rules');
      for (const rule of this.config.rules) {
        lines.push(`- ${rule}`);
      }
      lines.push('');
    }

    if (this.config.forbidden && this.config.forbidden.length > 0) {
      lines.push('## Forbidden Operations');
      for (const rule of this.config.forbidden) {
        lines.push(`- **${rule.name}**: ${rule.message}`);
      }
      lines.push('');
    }

    if (this.config.checks && this.config.checks.length > 0) {
      lines.push('## Automatic Checks');
      for (const check of this.config.checks) {
        const req = check.required ? '[REQUIRED]' : '[OPTIONAL]';
        const desc = check.description ? ` — ${check.description}` : '';
        lines.push(`- ${req} ${check.type}: \`${check.command}\`${desc}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 检查指定工具+参数是否在禁止列表中
   */
  isForbidden(
    toolName: string,
    params: Record<string, unknown>
  ): { forbidden: boolean; message?: string } {
    if (!this.config.forbidden) return { forbidden: false };

    for (const rule of this.config.forbidden) {
      // 工具名匹配
      if (rule.tool && rule.tool !== toolName) continue;

      // 参数模式匹配
      if (rule.paramPattern) {
        try {
          const regex = new RegExp(rule.paramPattern);
          const paramStr = JSON.stringify(params);
          if (!regex.test(paramStr)) continue;
        } catch {
          // 正则无效，跳过
          continue;
        }
      }

      return { forbidden: true, message: rule.message };
    }

    return { forbidden: false };
  }

  /**
   * 获取指定类型的自动检查
   */
  getChecks(type: CheckConfig['type']): CheckConfig[] {
    if (!this.config.checks) return [];
    return this.config.checks.filter((c) => c.type === type || c.type === 'always');
  }

  /**
   * 获取命令别名
   */
  getCommand(alias: string): string | undefined {
    return this.config.commands?.[alias];
  }

  // ─────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────

  private loadGlobalConfig(): void {
    try {
      if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
        const raw = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
        const json = JSON.parse(raw) as Partial<ClaudeConfig>;
        this.config = { ...this.deepClone(json) };
        this.sources.push({
          path: GLOBAL_CONFIG_FILE,
          content: raw,
          lastModified: fs.statSync(GLOBAL_CONFIG_FILE).mtimeMs,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errors.push(`Failed to load global config: ${msg}`);
    }
  }

  private loadProjectConfig(): void {
    // 优先加载 CLAUDE.md（Markdown）
    const mdPath = path.join(this.cwd, 'CLAUDE.md');
    if (fs.existsSync(mdPath)) {
      this.loadClaudeMd(mdPath);
    }

    // 再加载 .claude.json（JSON 覆盖 Markdown）
    const jsonPath = path.join(this.cwd, '.claude.json');
    if (fs.existsSync(jsonPath)) {
      this.loadClaudeJson(jsonPath);
    }
  }

  private loadLocalConfig(): void {
    const localPath = path.join(this.cwd, '.claude.local.json');
    if (fs.existsSync(localPath)) {
      this.loadClaudeJson(localPath);
    }
  }

  private loadClaudeMd(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.parseClaudeMd(content);
      // Markdown 配置覆盖已有配置
      this.config = this.deepMerge(this.config, parsed);
      this.sources.push({
        path: filePath,
        content,
        lastModified: fs.statSync(filePath).mtimeMs,
      });
      // 记录项目根目录
      if (!this.config.projectRoot) {
        this.config.projectRoot = path.dirname(filePath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errors.push(`Failed to parse CLAUDE.md: ${msg}`);
    }
  }

  private loadClaudeJson(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(raw) as Partial<ClaudeConfig>;
      this.config = this.deepMerge(this.config, json);
      this.sources.push({
        path: filePath,
        content: raw,
        lastModified: fs.statSync(filePath).mtimeMs,
      });
      if (!this.config.projectRoot) {
        this.config.projectRoot = path.dirname(filePath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errors.push(`Failed to parse ${path.basename(filePath)}: ${msg}`);
    }
  }

  /**
   * 解析 CLAUDE.md Markdown 格式
   *
   * 支持的段落：
   *   # Overview
   *   ## Languages
   *   - TypeScript, Node.js
   *   ## Code Style
   *   ## Rules
   *   - Always use strict TypeScript
   *   ## Commands
   *   - /test: npm run test
   *   ## Forbidden
   *   - Never delete files directly
   */
  private parseClaudeMd(content: string): Partial<ClaudeConfig> {
    const config: Partial<ClaudeConfig> = {};
    const lines = content.split('\n');

    let currentSection: string | null = null;
    let languages: string[] = [];
    let rules: string[] = [];
    let commands: Record<string, string> = {};
    let forbiddenLines: string[] = [];
    let overviewLines: string[] = [];
    let codeStyleLines: string[] = [];
    let initLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 检测段落标题（支持 # 和 ##）
      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        // 提交上一个段落
        this.flushSection(config, currentSection, {
          languages,
          rules,
          commands,
          forbiddenLines,
          overviewLines,
          codeStyleLines,
          initLines,
        });
        currentSection = headingMatch[2].toLowerCase();
        // 重置临时缓冲区
        languages = [];
        rules = [];
        commands = {};
        forbiddenLines = [];
        overviewLines = [];
        codeStyleLines = [];
        initLines = [];
        continue;
      }

      if (!currentSection) continue;

      // 无序列表项
      if (trimmed.startsWith('- ')) {
        const item = trimmed.slice(2).trim();

        if (currentSection === 'overview' || currentSection === '项目概述') {
          overviewLines.push(item);
        } else if (currentSection === 'languages' || currentSection === '编程语言') {
          languages.push(...item.split(',').map((s) => s.trim()));
        } else if (currentSection === 'rules' || currentSection === '规则') {
          rules.push(item);
        } else if (currentSection === 'commands' || currentSection === '命令') {
          const colonIdx = item.indexOf(':');
          if (colonIdx > 0) {
            const alias = item.slice(0, colonIdx).trim();
            const cmd = item.slice(colonIdx + 1).trim();
            commands[alias] = cmd;
          }
        } else if (
          currentSection === 'forbidden' ||
          currentSection === '禁止' ||
          currentSection === 'forbidden operations'
        ) {
          forbiddenLines.push(item);
        } else if (currentSection === 'initialization' || currentSection === '初始化') {
          initLines.push(item);
        }
      }

      // 普通段落内容（累积到当前 section）
      else if (trimmed && !trimmed.startsWith('```')) {
        if (currentSection === 'overview' || currentSection === '项目概述') {
          overviewLines.push(trimmed);
        } else if (currentSection === 'code style' || currentSection === '代码风格') {
          codeStyleLines.push(trimmed);
        } else if (currentSection === 'initialization' || currentSection === '初始化') {
          initLines.push(trimmed);
        }
      }
    }

    // 提交最后一个段落
    this.flushSection(config, currentSection, {
      languages,
      rules,
      commands,
      forbiddenLines,
      overviewLines,
      codeStyleLines,
      initLines,
    });

    return config;
  }

  private flushSection(
    config: Partial<ClaudeConfig>,
    section: string | null,
    data: {
      languages: string[];
      rules: string[];
      commands: Record<string, string>;
      forbiddenLines: string[];
      overviewLines: string[];
      codeStyleLines: string[];
      initLines: string[];
    }
  ): void {
    if (!section) return;

    if (section === 'overview' || section === '项目概述') {
      if (data.overviewLines.length > 0) {
        config.overview = data.overviewLines.join(' ').trim();
      }
    } else if (section === 'languages' || section === '编程语言') {
      if (data.languages.length > 0) {
        config.languages = data.languages;
      }
    } else if (section === 'code style' || section === '代码风格') {
      if (data.codeStyleLines.length > 0) {
        config.codeStyle = data.codeStyleLines.join('\n').trim();
      }
    } else if (section === 'rules' || section === '规则') {
      if (data.rules.length > 0) {
        config.rules = [...(config.rules || []), ...data.rules];
      }
    } else if (section === 'commands' || section === '命令') {
      if (Object.keys(data.commands).length > 0) {
        config.commands = { ...(config.commands || {}), ...data.commands };
      }
    } else if (
      section === 'forbidden' ||
      section === '禁止' ||
      section === 'forbidden operations'
    ) {
      if (data.forbiddenLines.length > 0) {
        const forbidden = data.forbiddenLines.map((line) => ({
          name: line.split(':')[0].trim(),
          message: line.includes(':') ? line.split(':').slice(1).join(':').trim() : line,
          description: line,
        }));
        config.forbidden = [...(config.forbidden || []), ...forbidden];
      }
    } else if (section === 'initialization' || section === '初始化') {
      if (data.initLines.length > 0) {
        config.initialization = data.initLines.join('\n').trim();
      }
    }
  }

  private deepMerge(target: Partial<ClaudeConfig>, source: Partial<ClaudeConfig>): Partial<ClaudeConfig> {
    const result: Partial<ClaudeConfig> = { ...target };

    for (const key of Object.keys(source) as (keyof ClaudeConfig)[]) {
      const srcVal = source[key];
      const tgtVal = result[key];

      if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
        // 数组直接覆盖而非合并（避免重复）
        (result as Record<string, unknown>)[key] = srcVal;
      } else if (
        typeof srcVal === 'object' &&
        srcVal !== null &&
        !Array.isArray(srcVal)
      ) {
        (result as Record<string, unknown>)[key] = {
          ...(tgtVal as Record<string, unknown>),
          ...(srcVal as Record<string, unknown>),
        };
      } else if (srcVal !== undefined) {
        (result as Record<string, unknown>)[key] = srcVal;
      }
    }

    return result;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
