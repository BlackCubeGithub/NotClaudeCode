<div align="center">

# 🤖 NotClaudeCode

**一个强大的 AI 代码助手 CLI 工具**

*灵感来源于 Claude Code，使用 TypeScript 从零构建*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.1.2-orange.svg)](package.json)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [工具列表](#-支持的工具) • [API 提供商](#-支持的-ai-提供商) • [技能系统](#-技能系统) • [开发](#-开发)

</div>

---

## 📖 项目简介

NotClaudeCode 是一个功能丰富的 AI 代码助手命令行工具，目标是复刻 Claude Code 的核心体验。内置多 AI 提供商支持（DeepSeek / OpenAI / 智谱 / 通义千问 / Kimi），提供文件操作、代码编辑、命令执行、网络搜索、Git 操作等丰富工具集。

核心亮点包括：**四层上下文压缩架构**（智能管理长对话）、**多会话持久化系统**（支持检查点回溯）、**智能记忆提取**（自动记录项目概要、任务、决策）、以及**可扩展的技能系统**。

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🔧 丰富的工具集
- 📂 文件读写与编辑（Read / Write / Edit）
- 🔍 代码搜索与模式匹配（Grep / Glob）
- 💻 终端命令执行与进程管理
- 📝 任务列表管理（TodoWrite）
- 🌐 网络搜索与网页抓取
- 📚 **完整的 Git 工具集**（9 个子命令）

</td>
<td width="50%">

### 🚀 核心特性
- 🌊 **流式输出** — 实时显示 AI 响应，逐 token 渲染
- 🤖 **多模型支持** — 5 种 AI 提供商，灵活切换
- 💬 **多会话管理** — 会话持久化，检查点回溯
- 🎨 **美观 CLI** — Chalk 彩色输出，Ora 进度提示
- 🧠 **四层压缩** — 自动上下文管理，处理超长对话
- 📦 **技能系统** — 内置 + 自定义多步骤工作流

</td>
</tr>
<tr>
<td width="50%">

### 🧠 智能记忆系统
- 📦 **会话持久化** — 自动保存对话状态到 `~/.notclaudecode/`
- 🔄 **四层压缩** — Layer 0~3 渐进式上下文管理
- 📑 **检查点** — 随时回溯任意对话状态
- 🗂️ **多会话** — 多个并行工作上下文，随时切换
- 🎯 **记忆提取** — 自动记录项目概要 / 任务 / 决策 / 问题

</td>
<td width="50%">

### 🗜️ 四层压缩架构
| 层级 | 触发条件 | 压缩策略 |
|:----:|:--------:|:---------|
| Layer 0 | < 70% | 正常运行，无需操作 |
| Layer 1 | 70–85% | 清理旧工具结果 |
| Layer 2 | 85–95% | 提取会话记忆，压缩历史 |
| Layer 3 | ≥ 95% | AI 生成对话摘要 |

</td>
</tr>
</table>

## 🎯 快速开始

### 安装

```bash
git clone https://github.com/BlackCubeGithub/NotClaudeCode.git
cd NotClaudeCode
npm install
npm run build
```

### 配置

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置一个提供商：

```env
# DeepSeek API (推荐 - 性价比高)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# OpenAI API (可选)
OPENAI_API_KEY=your_openai_api_key_here

# 智谱 API (可选)
ZHIPU_API_KEY=your_zhipu_api_key_here

# 通义千问 API (可选)
QWEN_API_KEY=your_qwen_api_key_here

# Kimi API (可选)
KIMI_API_KEY=your_kimi_api_key_here

# Tavily AI (用于网络搜索，可选)
TAVILY_API_KEY=your_tavily_api_key_here
```

### 启动

```bash
# 开发模式（ts-node）
npm run dev

# 生产模式
npm start

# 指定提供商和模型
npm run dev -- --provider deepseek --model deepseek-chat
```

## 📚 使用指南

### CLI 命令

在交互界面中输入以下命令：

| 命令 | 说明 |
|:-----|:-----|
| `/help` | 显示帮助信息 |
| `/clear` | 清除对话历史 |
| `/history` | 显示对话历史 |
| `/context` | 显示上下文使用统计 |
| `/memory` | 显示会话记忆摘要 |
| `/compact` | 手动触发上下文压缩 |
| `/session` | 显示当前会话信息 |
| `/session new` | 创建新会话 |
| `/session list` | 列出所有会话 |
| `/session switch` | 切换到其他会话 |
| `/session delete` | 删除会话 |
| `/checkpoint` | 创建检查点 |
| `/checkpoint list` | 列出检查点 |
| `/checkpoint <id>` | 恢复到检查点 |
| `/skill` | 列出 / 执行技能 |
| `/exit` 或 `/quit` | 退出程序 |

### 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|:-----|:-----|:-----|:-------|
| `--provider` | `-p` | AI 提供商 | `deepseek` |
| `--model` | `-m` | AI 模型 | `deepseek-chat` |
| `--directory` | `-d` | 工作目录 | 当前目录 |
| `--debug` | | 启用调试模式 | `false` |

### 使用示例

```bash
# 使用 DeepSeek（默认，推荐）
npm run dev

# 使用 OpenAI GPT-4
npm run dev -- -p openai -m gpt-4-turbo-preview

# 使用智谱 GLM-4
npm run dev -- -p zhipu -m glm-4-flash

# 使用通义千问
npm run dev -- -p qwen -m qwen-turbo

# 使用 Kimi（超长上下文）
npm run dev -- -p kimi -m moonshot-v1-128k

# 指定工作目录
npm run dev -- -d /path/to/your/project
```

## 🛠️ 支持的工具

### 📁 文件操作

| 工具 | 说明 |
|:-----|:-----|
| `Read` | 读取文件内容，支持指定行范围 |
| `Write` | 写入或创建新文件 |
| `Edit` | 搜索替换编辑文件 |
| `LS` | 列出目录内容 |
| `Glob` | 文件模式匹配查找 |
| `Grep` | 文件内容正则搜索 |

### 💻 命令执行

| 工具 | 说明 |
|:-----|:-----|
| `RunCommand` | 执行终端命令 |
| `CheckCommandStatus` | 检查异步命令状态 |
| `StopCommand` | 停止运行中的命令 |

### 📝 任务管理

| 工具 | 说明 |
|:-----|:-----|
| `TodoWrite` | 创建和管理任务列表 |

### 🌐 网络功能

| 工具 | 说明 |
|:-----|:-----|
| `WebSearch` | 使用 Tavily AI 搜索互联网 |
| `WebFetch` | 获取网页内容并转换为 Markdown |
| `GetTime` | 获取当前日期和时间 |

### 📚 Git 操作

| 工具 | 说明 |
|:-----|:-----|
| `GitStatus` | 查看当前 Git 状态 |
| `GitCommit` | 提交更改（自动分析变更） |
| `GitPush` | 推送到远程仓库 |
| `GitPull` | 从远程仓库拉取 |
| `GitDiff` | 查看文件变更 |
| `GitBranch` | 查看 / 创建 / 切换分支 |
| `GitLog` | 查看提交历史 |
| `GitMerge` | 合并分支 |
| `GitStash` | 暂存工作区更改 |

## 🤖 支持的 AI 提供商

### DeepSeek *(推荐)*

| 属性 | 说明 |
|:-----|:-----|
| **推荐模型** | `deepseek-chat`、`deepseek-coder` |
| **特点** | 💰 性价比高、🎯 代码能力强、🇨🇳 国内可用 |

### OpenAI

| 属性 | 说明 |
|:-----|:-----|
| **推荐模型** | `gpt-4-turbo-preview`、`gpt-4`、`gpt-3.5-turbo` |
| **特点** | 🌟 能力全面、🔧 生态完善、🌍 全球可用 |

### 智谱 AI

| 属性 | 说明 |
|:-----|:-----|
| **推荐模型** | `glm-4-flash`、`glm-4` |
| **特点** | ⚡ 响应快速、🇨🇳 国内可用、💰 免费额度 |

### 通义千问

| 属性 | 说明 |
|:-----|:-----|
| **推荐模型** | `qwen-turbo`、`qwen-plus`、`qwen-max` |
| **特点** | 🇨🇳 国内可用、📊 长文本支持、💰 免费额度 |

### Kimi

| 属性 | 说明 |
|:-----|:-----|
| **推荐模型** | `moonshot-v1-8k`、`moonshot-v1-32k`、`moonshot-v1-128k` |
| **特点** | 📄 超长上下文（128K）、🇨🇳 国内可用、💰 免费额度 |

## 🧩 技能系统

NotClaudeCode 内置可扩展的技能系统，支持自定义多步骤工作流。

### 内置技能

| 技能 | 命令 | 说明 |
|:-----|:-----|:-----|
| 📄 文档生成 | `/document` | 为代码生成文档注释 |
| 💡 代码解释 | `/explain-code` | 解释代码功能和工作原理 |
| 🔨 代码重构 | `/refactor` | 重构代码，提升可读性和性能 |
| 🧪 测试生成 | `/test-generator` | 为代码生成单元测试 |
| 🔍 代码审查 | `/code-review` | 审查代码并提供改进建议 |

### 自定义技能

技能以 Markdown 文件（`SKILL.md`）格式定义，支持多步骤 Agent 工作流。

加载优先级（从高到低）：
1. `~/.notclaude/skills/*.md` — 用户级技能
2. `./.claude/skills/*.md` — 项目级技能
3. `./SKILL.md` — 项目根目录技能
4. `src/core/skills/built-in/*.md` — 内置技能

### 创建自定义技能示例

```markdown
# SKILL.md

# My Custom Skill

## 描述
这是一个自定义技能，用于执行特定任务。

## 步骤
1. 使用 Grep 搜索相关代码
2. 使用 Read 阅读文件内容
3. 使用 Edit 进行修改
4. 使用 RunCommand 验证结果

## 工具
- Grep
- Read
- Edit
- RunCommand
```

## 📁 项目结构

```
NotClaudeCode/
├── src/
│   ├── ai/                          # AI 提供商适配器
│   │   ├── openai-provider.ts       # OpenAI 适配器
│   │   ├── deepseek-provider.ts     # DeepSeek 适配器
│   │   ├── zhipu-provider.ts        # 智谱 GLM-4 适配器
│   │   ├── qwen-provider.ts         # 通义千问适配器
│   │   └── kimi-provider.ts         # Kimi/Moonshot 适配器
│   │
│   ├── cli/                         # CLI 入口与交互逻辑
│   │   └── index.ts                 # 主 CLI 逻辑（~960 行）
│   │
│   ├── core/                        # Agent 核心逻辑
│   │   ├── agent.ts                 # Agent 主循环（约 680 行）
│   │   ├── session-manager.ts       # 多会话生命周期管理
│   │   ├── storage.ts               # 持久化存储层
│   │   ├── compact.ts               # Layer 1 压缩（工具结果清理）
│   │   ├── memory.ts                # Layer 2/3 压缩（记忆提取与摘要）
│   │   ├── context-monitor.ts       # 自动压缩触发器
│   │   └── skills/
│   │       ├── skill-manager.ts     # 技能执行引擎
│   │       ├── skill-parser.ts      # SKILL.md 解析器
│   │       └── built-in/            # 内置技能定义
│   │           ├── document.md
│   │           ├── explain-code.md
│   │           ├── refactor.md
│   │           ├── test-generator.md
│   │           └── code-review.md
│   │
│   ├── tools/                       # 工具实现
│   │   ├── base.ts                  # 工具基类
│   │   ├── registry.ts               # 工具注册中心
│   │   ├── read.ts                   # 文件读取
│   │   ├── write.ts                  # 文件写入
│   │   ├── edit.ts                   # 搜索替换
│   │   ├── ls.ts                     # 目录列表
│   │   ├── glob.ts                   # 模式匹配
│   │   ├── grep.ts                   # 内容搜索
│   │   ├── run-command.ts            # 命令执行
│   │   ├── check-command-status.ts   # 进程状态
│   │   ├── stop-command.ts           # 停止命令
│   │   ├── todo-write.ts             # 任务管理
│   │   ├── todo-manager.ts
│   │   ├── web-search.ts             # 网络搜索
│   │   ├── web-fetch.ts              # 网页抓取
│   │   ├── get-time.ts               # 时间获取
│   │   ├── skill.ts                  # 技能调用
│   │   └── git/                      # Git 工具集
│   │       ├── base.ts
│   │       ├── git-status.ts
│   │       ├── git-commit.ts
│   │       ├── git-push.ts
│   │       ├── git-pull.ts
│   │       ├── git-diff.ts
│   │       ├── git-branch.ts
│   │       ├── git-log.ts
│   │       ├── git-merge.ts
│   │       └── git-stash.ts
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── index.ts
│   │   ├── session.ts               # 会话 / 记忆类型
│   │   └── skill.ts                 # 技能定义类型
│   │
│   ├── utils/                       # 工具函数
│   │   ├── debug.ts                 # 调试工具
│   │   ├── retry.ts                 # 重试机制
│   │   └── token-counter.ts         # Token 计数
│   │
│   ├── doc/                         # 开发文档
│   │   └── 2026-4-23updatelog.md    # 详细更新日志
│   │
│   ├── cli.ts                       # CLI 入口
│   └── index.ts                     # 模块导出
│
├── tests/                           # 测试文件
│   ├── agent-test.ts                # Agent 核心功能测试
│   ├── ai-providers-test.ts         # AI 提供商测试
│   ├── command-tools-test.ts        # 命令工具测试
│   ├── file-tools-test.ts           # 文件工具测试
│   ├── other-tools-test.ts          # 其他工具测试
│   ├── search-tools-test.ts         # 搜索工具测试
│   ├── storage-session-test.ts      # 存储与会话测试
│   ├── memory-system-test.ts        # 记忆系统测试
│   ├── network-test.ts              # 网络稳定性测试
│   └── auto-compact-test.ts        # 自动压缩测试
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建项目
npm run build

# 运行测试
npm run test:network       # 网络稳定性测试
npm run test:memory        # 记忆系统测试
npm run test:auto-compact   # 自动压缩测试

# 其他测试（手动执行）
ts-node tests/agent-test.ts              # Agent 核心功能测试
ts-node tests/ai-providers-test.ts       # AI 提供商测试
ts-node tests/command-tools-test.ts      # 命令工具测试
ts-node tests/file-tools-test.ts         # 文件工具测试
ts-node tests/other-tools-test.ts        # 其他工具测试
ts-node tests/search-tools-test.ts       # 搜索工具测试
ts-node tests/storage-session-test.ts    # 存储与会话测试
```

## 🔄 自动压缩机制

NotClaudeCode 在对话过程中自动管理上下文使用，模仿 Claude Code 的实现机制。

### 工作原理

系统通过 `ContextMonitor` 实时监控上下文使用率，渐进触发不同层级的压缩：

| 层级 | 触发条件 | 压缩策略 | 说明 |
|:----:|:--------:|:---------|:-----|
| **Layer 0** | < 70% | 无需操作 | 正常运行状态 |
| **Layer 1** | 70–85% | 工具结果清理 | 清理旧的工具调用结果，保留关键信息 |
| **Layer 2** | 85–95% | 会话记忆压缩 | 提取会话记忆，压缩历史对话 |
| **Layer 3** | ≥ 95% | AI 摘要压缩 | 调用 AI 生成对话摘要，紧急压缩 |

### 触发时机

- **工具调用后**：检查是否需要 Layer 1 压缩
- **对话轮次结束后**：检查是否需要 Layer 2/3 压缩
- **冷却机制**：两次压缩间隔至少 5 秒，避免频繁压缩

### 用户通知

自动压缩触发时，系统会显示通知：

```
---
🔄 Context Auto-Compacted
- Layer: 2
- Tokens Saved: 15000
- Usage: 85000 → 70000
---
```

## 📋 更新历史

| 版本 | 提交 | 说明 |
|:----:|:-----|:-----|
| 0.1.2 | `f8c2882` | 新增完整 Git 工具集（9 个子命令），修复技能命令 |
| 0.1.2 | `8687a30` | 创建技能系统初始化 |
| 0.1.1 | `7da089b` | 文档更新 |
| 0.1.1 | `74173c0` | 代码质量优化，ESLint 配置与测试套件完善 |
| 0.1.1 | `b22ccea` | 合规性文件更新，自动上下文压缩机制完善 |
| 0.1.0 | `a1ff5db` | 会话管理机制、检查点机制、四层上下文压缩策略 V1 实现 |
| 0.1.0 | `3cc6636` | README 更新 |
| 0.1.0 | `b54115c` | 联网搜索稳定性更新 |
| 0.1.0 | `351f24b` | 新增 DeepSeek/Qwen/Kimi/GLM 支持与 Debug 模式 |
| 0.1.0 | `0025bff` | 工具系统更新 |
| 0.1.0 | `fc229a5` | 新增 Todo 工具和 Web 搜索工具 |
| 0.1.0 | `ad51e13` | 初始版本发布 |

详细更新日志请参考 [src/doc/2026-4-23updatelog.md](src/doc/2026-4-23updatelog.md)。

## 📋 TODO

### ✅ 近期已完成

- [x] **危险操作拦截系统** — Agent 层统一拦截，CLI 交互确认（agent 无法绕过）
- [x] **工具基类验证重构** — `validateRequiredParams` 从 `ToolResult|null` 改为 `void` + 抛异常
- [x] **配置文件系统（NOTCLAUDECODE.md）** — 多层级配置、Markdown 解析、system prompt 注入、`/config` 命令

### 🎯 近期计划

- [ ] **压缩预览功能** — 压缩前显示预估效果
- [ ] **会话导出 / 导入** — 支持会话数据的导出和导入
- [ ] **Agent 配置项** — 支持自定义压缩阈值等运行时配置

### 🚀 中期计划

- [ ] **自动化测试工作流** — 自动检测代码变更并运行测试
- [ ] **项目健康检查** — 自动分析项目结构和代码质量
- [ ] **多语言支持** — CLI 界面国际化

### 🔮 长期规划

- [ ] **独立仓库拆分** — 将自动化工作流拆分为独立项目
- [ ] **插件系统** — 支持自定义工具和命令扩展
- [ ] **Web UI** — 提供图形化界面
- [ ] **协作功能** — 多人会话和共享会话

### 🐛 已知问题

- [ ] PowerShell 脚本执行策略限制（Windows 环境）
- [ ] 大文件读取性能优化
- [ ] 长对话历史加载优化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 🙏 致谢

- 灵感来源于 [Claude Code](https://claude.ai/)
- 感谢所有 AI 提供商的 API 支持

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star！⭐**

Made with ❤️ by [BlackCube](https://github.com/BlackCubeGithub)

</div>
