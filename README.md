<div align="center">

# 🤖 NotClaudeCode

**一个强大的 AI 代码助手 CLI 工具**

*灵感来源于 Claude Code，使用 TypeScript 实现*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.1.0-orange.svg)](package.json)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [工具列表](#-支持的工具) • [API 提供商](#-支持的-ai-提供商)

</div>

---

## 📖 项目简介

NotClaudeCode 是一个功能丰富的 AI 代码助手命令行工具，支持多种 AI 提供商，提供文件操作、代码编辑、命令执行、网络搜索等强大功能。通过流式输出实现实时响应，带来流畅的交互体验。

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🔧 丰富的工具集
- 📂 文件读写与编辑
- 🔍 代码搜索与模式匹配
- 💻 终端命令执行
- 📝 任务列表管理
- 🌐 网络搜索与网页抓取

</td>
<td width="50%">

### 🚀 核心特性
- 🌊 **流式输出** - 实时显示 AI 响应
- 🤖 **多模型支持** - 5 种 AI 提供商
- 💬 **对话管理** - 多轮对话与历史记录
- 🎨 **美观 CLI** - 彩色输出与进度提示
- 🔐 **安全优先** - 不暴露敏感信息

</td>
</tr>
<tr>
<td width="50%">

### 🧠 智能记忆系统
- 📦 **会话持久化** - 自动保存对话状态
- 🔄 **四层压缩** - 智能上下文管理
- 📑 **检查点** - 随时回溯对话状态
- 🗂️ **多会话管理** - 轻松切换工作上下文

</td>
<td width="50%">

### 🗜️ 四层压缩架构
- **Layer 0**: 正常运行 (< 70% 使用率)
- **Layer 1**: 工具结果清理 (70-85%)
- **Layer 2**: 会话记忆压缩 (85-95%)
- **Layer 3**: AI 摘要压缩 (≥ 95%)

</td>
</tr>
</table>

## 🎯 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/BlackCubeGithub/NotClaudeCode.git
cd NotClaudeCode

# 安装依赖
npm install

# 构建项目
npm run build
```

### 配置

创建 `.env` 文件并配置你的 API Key：

```bash
# 复制示例文件
cp .env.example .env
```

编辑 `.env` 文件，选择至少一个提供商进行配置：

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
```

### 启动

```bash
# 开发模式
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
# 使用 DeepSeek (默认)
npm run dev

# 使用 OpenAI GPT-4
npm run dev -- -p openai -m gpt-4-turbo-preview

# 使用智谱 GLM-4
npm run dev -- -p zhipu -m glm-4-flash

# 使用通义千问
npm run dev -- -p qwen -m qwen-turbo

# 使用 Kimi
npm run dev -- -p kimi -m moonshot-v1-8k

# 指定工作目录
npm run dev -- -d /path/to/your/project
```

## 🛠️ 支持的工具

NotClaudeCode 提供了丰富的工具集，让 AI 能够帮助你完成各种任务：

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
| **特点** | 📄 超长上下文、🇨🇳 国内可用、💰 免费额度 |

## 📁 项目结构

```
NotClaudeCode/
├── 📂 src/
│   ├── 📂 ai/                    # AI 提供商实现
│   │   ├── openai-provider.ts    # OpenAI 适配器
│   │   ├── deepseek-provider.ts  # DeepSeek 适配器
│   │   ├── zhipu-provider.ts     # 智谱适配器
│   │   ├── qwen-provider.ts      # 通义千问适配器
│   │   └── kimi-provider.ts      # Kimi 适配器
│   │
│   ├── 📂 cli/                   # 命令行界面
│   │   └── index.ts              # CLI 入口与交互逻辑
│   │
│   ├── 📂 core/                  # 核心逻辑
│   │   ├── agent.ts              # Agent 核心实现
│   │   ├── session-manager.ts    # 会话管理器
│   │   ├── storage.ts            # 持久化存储
│   │   ├── compact.ts            # Layer 1 压缩
│   │   ├── memory.ts             # Layer 2/3 压缩
│   │   └── index.ts
│   │
│   ├── 📂 tools/                 # 工具实现
│   │   ├── base.ts               # 工具基类
│   │   ├── registry.ts           # 工具注册中心
│   │   ├── read.ts               # 文件读取
│   │   ├── write.ts              # 文件写入
│   │   ├── edit.ts               # 文件编辑
│   │   ├── ls.ts                 # 目录列表
│   │   ├── glob.ts               # 文件匹配
│   │   ├── grep.ts               # 内容搜索
│   │   ├── run-command.ts        # 命令执行
│   │   ├── check-command-status.ts
│   │   ├── stop-command.ts
│   │   ├── todo-write.ts         # 任务管理
│   │   ├── todo-manager.ts
│   │   ├── web-search.ts         # 网络搜索
│   │   ├── web-fetch.ts          # 网页抓取
│   │   └── get-time.ts           # 时间获取
│   │
│   ├── 📂 types/                 # TypeScript 类型定义
│   │   ├── index.ts              # 核心类型
│   │   └── session.ts            # 会话相关类型
│   │
│   ├── 📂 utils/                 # 工具函数
│   │   ├── debug.ts              # 调试工具
│   │   ├── retry.ts              # 重试机制
│   │   └── token-counter.ts      # Token 计数
│   │
│   ├── cli.ts                    # CLI 入口
│   └── index.ts                  # 模块导出
│
├── 📂 tests/                     # 测试文件
│   ├── network-test.ts           # 网络稳定性测试
│   └── memory-system-test.ts     # 四层记忆系统测试
│
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 .env.example
└── 📄 README.md
```

## 🔧 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建项目
npm run build

# 网络测试
npm run test:network

# 记忆系统测试
npm run test:memory
```

## 📋 TODO

### 🎯 近期计划

- [ ] **自动压缩触发优化** - 在对话过程中自动检测并触发压缩
- [ ] **压缩预览功能** - 压缩前显示预估效果
- [ ] **会话导出/导入** - 支持会话数据的导出和导入
- [ ] **配置文件支持** - 支持自定义压缩阈值等配置

### 🚀 中期计划

- [ ] **自动文档生成** - 扫描项目自动生成 PRD & SPEC 文档
- [ ] **自动化测试工作流** - 自动检测代码变更并运行测试
- [ ] **项目健康检查** - 自动分析项目结构和代码质量
- [ ] **多语言支持** - CLI 界面国际化

### 🔮 长期规划

- [ ] **独立仓库拆分** - 将自动化工作流拆分为独立项目
- [ ] **插件系统** - 支持自定义工具和命令扩展
- [ ] **Web UI** - 提供图形化界面
- [ ] **协作功能** - 多人会话和共享会话

### 🐛 已知问题

- [ ] PowerShell 脚本执行策略限制 (Windows)
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
