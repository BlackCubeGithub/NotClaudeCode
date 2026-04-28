/**
 * NOTCLAUDECODE.md / .notclaudecode.json 配置系统类型定义
 *
 * 支持多层级配置合并：
 * 1. 全局配置  (~/.notclaudecode/config.json)
 * 2. 项目配置  (.notclaudecode.json / NOTCLAUDECODE.md)
 * 3. 本地覆盖  (.notclaudecode.local.json)
 *
 * 优先级：本地 > 项目 > 全局
 */

export interface ClaudeConfig {
  /** 项目概述 — 会注入到 system prompt */
  overview?: string;

  /** 编程语言 */
  languages?: string[];

  /** 代码风格规范 */
  codeStyle?: string;

  /** 命令别名映射 */
  commands?: Record<string, string>;

  /** 行为规则列表 */
  rules?: string[];

  /** 禁止的操作列表 */
  forbidden?: ForbiddenRule[];

  /** 危险操作白名单（绕过拦截） */
  dangerousAllowlist?: string[];

  /** 忽略的文件/目录模式 */
  ignorePatterns?: string[];

  /** 自动执行的检查项（提交前 / 推送前等） */
  checks?: CheckConfig[];

  /** 首次启动时注入的初始化指令 */
  initialization?: string;

  /** 项目根目录路径（加载时自动填充） */
  projectRoot?: string;
}

export interface ForbiddenRule {
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 匹配的工具名或操作类型 */
  tool?: string;
  /** 正则匹配的参数条件 */
  paramPattern?: string;
  /** 违规时的提示信息 */
  message: string;
}

export interface CheckConfig {
  /** 检查类型 */
  type: 'pre_commit' | 'pre_push' | 'pre_build' | 'always';
  /** 检查命令 */
  command: string;
  /** 失败时是否阻止操作 */
  required: boolean;
  /** 检查描述 */
  description?: string;
}

/** 解析后的 NOTCLAUDECODE.md 原始段落 */
export interface ConfigSource {
  path: string;
  content: string;
  lastModified: number;
}

/** ConfigManager 加载结果 */
export interface ConfigLoadResult {
  config: ClaudeConfig;
  sources: ConfigSource[];
  merged: boolean;
  errors: string[];
}

/** 合并后的配置项来源追踪 */
export interface ConfigOverride {
  key: string;
  source: 'global' | 'project' | 'local';
  value: unknown;
}
