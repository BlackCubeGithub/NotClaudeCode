# NotClaudeCode 开发路线图

> 基于 Claude Code 2026 功能对比分析
> 更新时间：2026-04-28

## ✅ 本次已完成

### 重构与安全

| 功能 | 文件 | 说明 |
|:-----|:-----|:-----|
| **工具基类验证重构** | `src/tools/base.ts` | `validateRequiredParams` 从 `ToolResult\|null` 改为 `void` + 抛异常，符合 TS 范式 |
| **危险操作拦截系统** | `src/core/agent.ts` | 新增 `DangerousToolCallback` + `isDangerousTool()`，在 `Agent` 层统一拦截危险操作 |
| **交互式确认机制** | `src/cli/index.ts` | 通过 `inquirer` 触发真正的用户确认，agent 无法绕过 |
| **Force Push 安全确认** | `src/tools/git/git-push.ts` | `force=true` 时触发交互确认，已移除无效的 `force_confirmed` 参数 |

### 配置系统（NOTCLAUDECODE.md）

| 功能 | 文件 | 说明 |
|:-----|:-----|:-----|
| **配置类型定义** | `src/types/config.ts` | `ClaudeConfig` / `ForbiddenRule` / `CheckConfig` 等类型 |
| **ConfigManager** | `src/core/config-manager.ts` | 多层级配置加载、Markdown 解析、JSON 合并、热重载 |
| **系统提示词注入** | `src/core/agent.ts` | 项目配置自动注入 system prompt |
| **/config CLI 命令** | `src/cli/index.ts` | 显示和热重载项目配置 |
| **配置管理器测试** | `tests/config-manager-test.ts` | 11 个测试用例，全部通过 |

---

## 📊 项目现状分析

### ✅ 已实现的核心功能

#### 基础架构
- ✅ 多 AI 提供商支持（5 个：OpenAI, DeepSeek, Zhipu, Qwen, Kimi）
- ✅ 流式输出和实时响应
- ✅ 会话持久化和多会话管理
- ✅ 检查点回滚机制
- ✅ 四层上下文压缩架构（Layer 0–3）
- ✅ 自动压缩触发机制（ContextMonitor）
- ✅ 智能会话记忆提取（项目概要 / 任务 / 决策 / 问题）

#### 工具集
- ✅ 文件操作：Read, Write, Edit, LS, Glob, Grep
- ✅ 命令执行：RunCommand, CheckCommandStatus, StopCommand
- ✅ 任务管理：TodoWrite
- ✅ 网络功能：WebSearch, WebFetch, GetTime
- ✅ **Git 操作（9 个子命令）**：GitStatus, GitCommit, GitPush, GitPull, GitDiff, GitBranch, GitLog, GitMerge, GitStash

#### 技能系统
- ✅ 技能执行引擎（SkillManager + SkillParser）
- ✅ 内置技能：`/document`（文档生成）、`/explain-code`（代码解释）、`/refactor`（代码重构）、`/test-generator`（测试生成）、`/code-review`（代码审查）
- ✅ 多路径技能加载（用户级 / 项目级 / 内置）

#### CLI 界面
- ✅ 彩色输出和进度提示（Chalk + Ora）
- ✅ 交互式命令系统（Inquirer）
- ✅ 斜杠命令：`/help`, `/clear`, `/history`, `/context`, `/memory`, `/compact`, `/session`, `/checkpoint`, `/skill`
- ✅ 会话管理命令（新建 / 列表 / 切换 / 删除）
- ✅ 检查点管理命令（创建 / 列表 / 恢复）

#### 测试和质量
- ✅ ESLint 配置与代码质量优化
- ✅ 8 个完整测试套件
- ✅ TypeScript 严格模式
- ✅ 自动压缩机制测试

### ❌ 与 Claude Code 2026 的主要差距

根据调研，Claude Code 2026 版本已发展为功能强大的 AI 编程中枢，我们的项目已跨越初始阶段，以下核心功能仍在开发计划中：

---

## 🎯 开发计划

### 📅 第一阶段：核心功能补全（优先级：高）

#### 1. Git 集成 ⭐⭐⭐⭐⭐

**功能描述**：
- ✅ Git 操作工具（commit, push, pull, branch, merge, diff, status, log, stash）
- ✅ Commit 消息自动分析生成
- ✅ **Force Push 危险操作拦截**（Agent 层统一确认，agent 无法绕过）
- ⬜ PR 创建和审查（GitHub CLI）
- ⬜ 冲突检测和解决
- ⬜ Diff 分析和历史调查

**文件结构（已实现）**：
```
src/tools/git/
├── base.ts            ✅ Git 工具基类
├── git-status.ts     ✅
├── git-commit.ts      ✅
├── git-push.ts       ✅ + 危险操作拦截
├── git-pull.ts       ✅
├── git-diff.ts       ✅
├── git-branch.ts     ✅
├── git-log.ts        ✅
├── git-merge.ts      ✅
└── git-stash.ts      ✅
```

**危险操作拦截（已实现）**：

| 危险操作 | 检测条件 | 确认机制 |
|:---------|:---------|:---------|
| Force Push | `toolName === 'GitPush' && params['force'] === true` | `inquirer` 交互确认 |

扩展方式：在 `Agent.isDangerousTool()` 中添加新条件即可，无需改动调用链。

**下一步**：
- ⬜ `git-pr.ts` — PR 创建和审查
- ⬜ `git-conflict.ts` — 冲突解决
- ⬜ `git-history.ts` — 历史调查
- ⬜ 集成 GitHub CLI 进行 PR 操作
- ⬜ 扩展危险操作检测：`git-reset --hard`、`git-rebase` 等

---

#### 2. 配置文件系统 ⭐⭐⭐⭐⭐

**功能描述**：
- ✅ NOTCLAUDECODE.md Markdown 配置解析（项目概述、编程语言、代码风格、规则、命令、禁止操作）
- ✅ .notclaudecode.json JSON 配置（与 Markdown 等效，优先级更高）
- ✅ .notclaudecode.local.json 本地覆盖（最高优先级）
- ✅ 项目配置自动注入 system prompt
- ✅ /config CLI 命令（显示和热重载）
- ✅ 禁止规则拦截（与危险操作拦截系统集成）
- ⬜ 配置热重载（无需重启应用）
- ⬜ NOTCLAUDECODE.md 自动生成（根据项目分析）

**文件结构（已实现）**：
```
src/types/config.ts          ✅ 配置类型定义
src/core/config-manager.ts   ✅ 配置管理器（~380 行）
tests/config-manager-test.ts ✅ 测试（11 个用例）
```

**配置文件示例（NOTCLAUDECODE.md）**：

```markdown
# Project Overview

A TypeScript Node.js project using Express framework.

## Languages
- TypeScript, Node.js, JavaScript

## Code Style
Use strict TypeScript with 2-space indentation.
Follow the Airbnb style guide.

## Commands
- /test: npm run test
- /build: npm run build
- /lint: npm run lint

## Rules
- Always run lint before commits
- Use absolute paths for file operations
- Prefer async/await over callbacks

## Forbidden Operations
- Force push without confirmation
- Writing to /prod paths without approval

## Automatic Checks
- [REQUIRED] pre_commit: npm run lint
- [REQUIRED] pre_push: npm run build
```

**预期收益**：
- 项目级别的定制化（编码规范、可用命令、禁止操作）
- 团队规范统一（通过 NOTCLAUDECODE.md 共享）
- 减少重复指令（规则自动注入 system prompt）

---

文件结构：
```
src/core/config-manager.ts   # 配置管理器
src/types/config.ts          # 配置类型定义
```

配置文件示例（NOTCLAUDECODE.md）：

```markdown
# Project Configuration

## Coding Conventions
- Use TypeScript strict mode
- Prefer functional components
- Use @/ for imports

## Commands
- /test: npm run test
- /build: npm run build

## Rules
- Always run lint after edits
- Never commit to main directly
```

技术要点：
- Markdown 解析器
- 配置继承和覆盖机制
- 热重载支持

**预期收益**：
- 项目级别的定制化
- 团队规范统一
- 减少重复指令

---

#### 3. 测试生成和执行 ⭐⭐⭐⭐

**功能描述**：
- ⬜ 自动生成单元测试（内置 `/test-generator` 技能可调用，但非自动化工作流）
- ⬜ 测试执行和调试
- ⬜ 测试覆盖率分析
- ⬜ TDD 工作流支持

**实现建议**：

文件结构：
```
src/tools/testing/
├── test-generator.ts       # 测试生成器
├── test-runner.ts          # 测试运行器
└── coverage-analyzer.ts    # 覆盖率分析
```

支持框架：
- Jest
- Vitest
- Mocha
- Pytest (Python)

功能特性：
- 智能测试用例生成
- 边界条件识别
- Mock 自动生成
- 测试失败诊断

**预期收益**：
- 提高测试覆盖率
- 减少测试编写时间
- 更好的代码质量保证

---

#### 4. 代码审查和安全审计 ⭐⭐⭐⭐

**功能描述**：
- ✅ `/code-review` 内置技能（可调用）
- ⬜ 安全漏洞检测（SQL 注入、XSS、权限漏洞）
- ⬜ 性能问题识别
- ⬜ 最佳实践建议
- ⬜ 自动 Lint 修复

**实现建议**：

文件结构：
```
src/tools/review/
├── code-reviewer.ts       # 代码审查（已有内置技能）
├── security-auditor.ts    # 安全审计
├── performance-analyzer.ts # 性能分析
└── lint-fixer.ts          # Lint 修复
```

检测能力：
- 安全漏洞（OWASP Top 10）
- 性能瓶颈
- 代码异味
- 架构问题
- 依赖安全

集成工具：
- ESLint
- Prettier
- npm audit
- Snyk

**预期收益**：
- 提高代码质量
- 减少安全风险
- 自动化代码规范

---

### 📅 第二阶段：高级功能（优先级：中）

#### 5. MCP（Model Context Protocol）集成 ⭐⭐⭐⭐⭐

**功能描述**：
- ⬜ 连接外部工具和服务
- ⬜ 数据库访问
- ⬜ API 集成
- ⬜ Slack/Discord 集成
- ⬜ 浏览器自动化

**实现建议**：

文件结构：
```
src/mcp/
├── mcp-client.ts              # MCP 客户端
├── mcp-server-manager.ts      # 服务器管理
└── servers/
    ├── database-server.ts     # 数据库服务器
    ├── slack-server.ts        # Slack 服务器
    └── browser-server.ts      # 浏览器服务器
```

协议实现：
- JSON-RPC 2.0
- WebSocket 通信
- 服务发现机制

内置服务器：
- PostgreSQL / MySQL
- Slack
- Discord
- Playwright（浏览器）

**预期收益**：
- 无限扩展能力
- 企业系统集成
- 自动化工作流

---

#### 6. 子代理系统 ⭐⭐⭐⭐

**功能描述**：
- ⬜ 专用子代理（Explore, Plan, Review）
- ⬜ 并行代理执行
- ⬜ 代理团队协作
- ⬜ 任务委托和分配

**实现建议**：

文件结构：
```
src/core/sub-agent/
├── sub-agent-manager.ts      # 代理管理器
├── agent-base.ts             # 代理基类
└── agents/
    ├── explore-agent.ts      # 探索代理
    ├── plan-agent.ts         # 规划代理
    └── review-agent.ts       # 审查代理
```

特性：
- 独立上下文
- 并行执行
- 结果聚合
- 任务队列

**预期收益**：
- 复杂任务分解
- 并行处理能力
- 专业化的 AI 助手

---

#### 7. Skills 系统 ⭐⭐⭐⭐

**功能描述**：
- ✅ 自定义工作流（SKILL.md）
- ✅ 可复用的任务模板
- ✅ 内置技能（`/document`, `/explain-code`, `/refactor`, `/test-generator`, `/code-review`）
- ⬜ 技能市场

**文件结构（已实现）**：
```
src/core/skills/
├── skill-manager.ts          ✅ 技能管理
├── skill-parser.ts           ✅ 技能解析
├── index.ts                  ✅
└── built-in/
    ├── document.md           ✅
    ├── explain-code.md      ✅
    ├── refactor.md          ✅
    ├── test-generator.md    ✅
    └── code-review.md       ✅
```

**下一步**：
- ⬜ 技能市场功能
- ⬜ 更多内置技能（`/batch`, `/simplify`, `/translate`）
- ⬜ 技能版本管理和更新

---

#### 8. Hooks 系统 ⭐⭐⭐

**功能描述**：
- ⬜ 生命周期事件钩子
- ⬜ 自动化工作流
- ⬜ 自定义事件处理
- ✅ **PreToolUse 钩子（部分实现）**：危险工具统一拦截与用户确认

**实现建议**：

文件结构：
```
src/core/hooks/
├── hook-manager.ts    # 钩子管理
├── event-bus.ts       # 事件总线
└── executor.ts        # 钩子执行器
```

事件类型：
- PreToolUse: 工具执行前
- PostToolUse: 工具执行后
- PostToolUseFailure: 工具执行失败
- Notification: 通知事件
- Stop: 会话停止

钩子配置示例：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "shell",
        "command": "npm run lint",
        "filter": { "tool": "Write" }
      }
    ]
  }
}
```

**预期收益**：
- 自动化工作流
- 质量保证
- 自定义行为

---

### 📅 第三阶段：企业级功能（优先级：中）

#### 9. 插件系统 ⭐⭐⭐⭐

**功能描述**：
- ⬜ 插件包管理
- ⬜ 插件市场
- ⬜ 版本控制和更新
- ⬜ 插件隔离

**实现建议**：

文件结构：
```
src/core/plugins/
├── plugin-manager.ts    # 插件管理
├── plugin-loader.ts     # 插件加载
└── plugin-market.ts     # 插件市场
```

插件结构：

```
my-plugin/
├── package.json
├── plugin.json          # 插件元数据
├── skills/              # 技能
├── agents/              # 代理
├── hooks/               # 钩子
└── tools/               # 工具
```

CLI 命令：
- `notclaude plugin install <name>`
- `notclaude plugin update`
- `notclaude plugin list`
- `notclaude plugin create`

**预期收益**：
- 生态扩展
- 社区贡献
- 功能模块化

---

#### 10. 多模态输入 ⭐⭐⭐

**功能描述**：
- ⬜ 图像输入支持
- ⬜ 截图分析
- ⬜ 设计稿转代码
- ⬜ 错误截图诊断

**实现建议**：

文件结构：
```
src/tools/multimodal/
├── image-input.ts          # 图像输入
├── screenshot-analyzer.ts  # 截图分析
└── design-to-code.ts       # 设计转代码
```

技术实现：
- 扩展 AI 提供商支持视觉模型（GPT-4V、Claude 3）
- 图像 Base64 编码
- 剪贴板图像读取
- 图像预处理

使用场景：
- Ctrl+V 粘贴截图
- 设计稿转组件
- 错误截图诊断
- UI 自动化测试

**预期收益**：
- 更直观的交互
- 设计开发一体化
- 快速问题诊断

---

#### 11. 远程控制和协作 ⭐⭐⭐

**功能描述**：
- ⬜ Web 界面
- ⬜ 远程会话控制
- ⬜ 多用户协作
- ⬜ 移动端访问

**实现建议**：

文件结构：
```
src/server/
├── web-server.ts        # Web 服务器
├── websocket.ts         # WebSocket 通信
└── collaboration.ts     # 协作管理
```

技术栈：
- Express / Fastify
- Socket.io
- React / Vue 前端

功能：
- 实时同步
- 权限管理
- 会话共享
- 消息推送

**预期收益**：
- 随时随地访问
- 团队协作
- 远程开发

---

#### 12. SDK / API ⭐⭐⭐

**功能描述**：
- ⬜ 编程接口
- ⬜ CI/CD 集成
- ⬜ 自动化脚本支持
- ⬜ GitHub Actions 集成

**实现建议**：

文件结构：
```
src/sdk/
├── index.ts      # SDK 入口
├── client.ts     # API 客户端
└── types.ts     # 类型定义
```

API 设计示例：

```typescript
import { ClaudeCode } from 'not-claude-code-sdk';

const client = new ClaudeCode({ provider: 'deepseek' });

// 代码生成
const code = await client.generateCode('Create a React hook');

// 文件操作
await client.writeFile('src/utils.ts', code);

// Git 操作
await client.commit('Add new utility function');
```

CI/CD 集成：
- GitHub Actions
- GitLab CI
- Jenkins

**预期收益**：
- 自动化集成
- 编程式调用
- 企业级应用

---

### 📅 第四阶段：创新功能（优先级：低）

#### 13. 自动记忆系统 ⭐⭐⭐

**功能描述**：
- ⬜ 跨会话学习
- ⬜ 自动记住用户偏好
- ⬜ 项目知识积累
- ⬜ 智能推荐

**实现建议**：

文件结构：
```
src/core/memory/
├── auto-memory.ts      # 自动记忆
├── knowledge-graph.ts   # 知识图谱
└── extractor.ts         # 智能提取
```

记忆类型：
- 用户偏好
- 项目规范
- 常见问题
- 最佳实践

实现：
- 向量数据库（Chroma / Pinecone）
- 语义搜索
- 自动分类

**预期收益**：
- 越用越智能
- 减少重复指令
- 知识沉淀

---

#### 14. 语音输入 ⭐⭐

**功能描述**：
- ⬜ 实时语音转文字
- ⬜ 多语言支持（20+）
- ⬜ 编程优化识别
- ⬜ 按键录音

**实现建议**：

文件结构：
```
src/tools/voice/
├── voice-input.ts   # 语音输入
└── transcriber.ts  # 转录引擎
```

技术选择：
- OpenAI Whisper API
- 本地 Whisper 模型
- Web Speech API

功能：
- Space 键按住录音
- 实时转录
- 编程术语优化
- 多语言识别

**预期收益**：
- 解放双手
- 快速输入
- 更自然的交互

---

#### 15. Git Worktree 隔离 ⭐⭐

**功能描述**：
- ⬜ 独立的仓库副本
- ⬜ 并行开发支持
- ⬜ 冲突避免
- ⬜ 自动清理

**实现建议**：

文件结构：
```
src/tools/git/worktree-manager.ts    # Worktree 管理
```

功能：
- 创建隔离环境
- 自动切换
- 环境清理
- 状态同步

使用场景：
- 并行功能开发
- 安全的实验
- 多版本测试

**预期收益**：
- 并行开发
- 隔离风险
- 提高效率

---

#### 16. 定时任务 ⭐⭐

**功能描述**：
- ⬜ 定期执行任务
- ⬜ 云端调度
- ⬜ 本地轮询
- ⬜ 任务队列

**实现建议**：

文件结构：
```
src/core/scheduler/
├── task-scheduler.ts    # 任务调度
├── cron-parser.ts       # Cron 解析
└── task-queue.ts        # 任务队列
```

调度方式：
- 云端（claude.ai）
- GitHub Actions
- 本地守护进程
- `/loop` 命令

示例：
- `/loop 5m check if the deploy finished`
- `/loop daily review open PRs`

**预期收益**：
- 自动化运维
- 定期检查
- 省心省力

---

## 🛠️ 技术改进建议

### 代码质量
- [ ] 完善测试覆盖：为所有新功能添加测试
- [x] 性能优化：四层压缩机制已实现，大文件处理待优化
- [ ] 错误处理：更友好的错误提示和恢复机制
- [ ] 文档完善：API 文档、架构文档、贡献指南

### 架构优化
- [ ] 模块化设计：更好的模块边界和依赖管理
- [ ] 插件架构：为核心功能设计插件接口
- [ ] 事件驱动：实现事件总线支持 Hooks 系统
- [x] 类型安全：完善 TypeScript 类型定义

### 用户体验
- [ ] 进度反馈：更详细的操作进度提示
- [ ] 撤销功能：支持操作撤销和重做
- [ ] 快捷键：添加键盘快捷键支持
- [ ] 主题系统：支持自定义主题

---

## 📈 推荐的开发顺序

### 第一优先级（1–2 个月）
1. **配置文件系统（NOTCLAUDECODE.md）** → 2. **测试生成工作流** → 3. **Git PR 和冲突解决** → 4. **安全审计增强**

### 第二优先级（2–3 个月）
5. **MCP 集成** → 6. **子代理系统** → 7. **Hooks 系统** → 8. **技能市场**

### 第三优先级（3–4 个月）
9. **插件系统** → 10. **多模态输入** → 11. **远程控制** → 12. **SDK / API**

### 第四优先级（长期规划）
13. **自动记忆** → 14. **语音输入** → 15. **Worktree** → 16. **定时任务**

---

## 💡 实施建议

### 开发原则
1. **渐进式开发**：每个功能独立开发，逐步集成
2. **用户反馈**：早期发布，收集用户反馈
3. **文档同步**：功能开发同时更新文档
4. **测试驱动**：先写测试，再实现功能
5. **版本管理**：使用语义化版本控制

### 质量保证
- 每个功能必须有对应的测试套件
- 代码审查通过后才能合并
- 保持至少 80% 的测试覆盖率
- 定期进行性能测试

### 发布策略
- 主版本号：重大架构变更或不兼容更新
- 次版本号：新功能添加
- 修订号：Bug 修复和小改进

---

## 🎯 里程碑目标

### v0.2.0 — Git 集成版（预计 1 个月）
- ✅ 完整 Git 工具集（9 个子命令）
- ✅ 技能系统初始化
- ✅ **危险操作拦截系统**（Agent 层统一确认）
- ✅ **配置文件系统（NOTCLAUDECODE.md）**
- ⬜ 基础测试生成工作流

### v0.3.0 — 企业协作版（预计 2 个月）
- ⬜ MCP 集成
- ⬜ 子代理系统
- ⬜ Hooks 系统
- ⬜ 技能市场

### v0.4.0 — 插件生态版（预计 3 个月）
- ⬜ 插件系统
- ⬜ 多模态输入
- ⬜ 远程控制
- ⬜ SDK / API

### v1.0.0 — 正式版（预计 4–5 个月）
- ⬜ 所有核心功能稳定
- ⬜ 完整文档
- ⬜ 企业级支持

---

## 📊 功能对比矩阵

| 功能类别 | Claude Code 2026 | NotClaudeCode 当前 | 计划版本 |
|----------|:----------------:|:------------------:|:--------:|
| 多 AI 提供商 | ✅ | ✅ | — |
| 流式输出 | ✅ | ✅ | — |
| 会话管理 | ✅ | ✅ | — |
| 上下文压缩 | ✅ | ✅ | — |
| Git 集成 | ✅ | ✅ **部分** | v0.2.0 |
| 配置文件 | ✅ | ✅ | — |
| 测试生成 | ✅ | ⬜ | v0.2.0 |
| 代码审查 | ✅ | ✅ **部分** | v0.2.0 |
| Skills | ✅ | ✅ | — |
| MCP 集成 | ✅ | ⬜ | v0.3.0 |
| 子代理 | ✅ | ⬜ | v0.3.0 |
| Hooks | ✅ | ⬜ | v0.3.0 |
| 插件系统 | ✅ | ⬜ | v0.4.0 |
| 多模态 | ✅ | ⬜ | v0.4.0 |
| 远程控制 | ✅ | ⬜ | v0.4.0 |
| SDK / API | ✅ | ⬜ | v0.4.0 |
| 自动记忆 | ✅ | ⬜ | v1.0.0 |
| 语音输入 | ✅ | ⬜ | v1.0.0 |
| Worktree | ✅ | ⬜ | v1.0.0 |
| 定时任务 | ✅ | ⬜ | v1.0.0 |

> 图例：✅ 已实现 · ⬜ 计划中

---

## 🤝 贡献指南

欢迎社区贡献！

### 优先贡献领域
1. 配置文件系统（NOTCLAUDECODE.md）
2. Git PR 和冲突解决
3. 测试用例编写
4. 文档翻译

### 提交规范
```
feat: 新功能
fix: Bug 修复
docs: 文档更新
refactor: 代码重构
test: 测试相关
chore: 构建 / 工具更新
```

---

## 📋 Git 提交历史（v0.1.x）

| 提交 | 说明 |
|:-----|:-----|
| `f8c2882` | 新增 Git 工具集与修复 Skill 命令 |
| `8687a30` | 创建 Skill 系统初始化 |
| `7da089b` | 文档更新 |
| `74173c0` | 代码质量优化、ESLint、测试套件增加 |
| `b22ccea` | 合规性文件更新，自动上下文压缩机制完善 |
| `a1ff5db` | 会话管理、检查点、四层上下文压缩 V1 |
| `351f24b` | 新增 DeepSeek/Qwen/Kimi/GLM 支持与 Debug 模式 |
| `fc229a5` | 新增 Todo 工具和 Web 搜索工具 |
| `ad51e13` | 初始版本发布 |

详细更新日志请参考 [src/doc/2026-4-23updatelog.md](src/doc/2026-4-23updatelog.md)。

---

**让我们一起打造最强大的开源 AI 编程助手！** 🚀
