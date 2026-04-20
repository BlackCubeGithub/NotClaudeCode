# NotClaudeCode

一个 Claude Code 的复现项目，使用 TypeScript 实现，支持 DeepSeek 和 OpenAI API。

## 功能特性

- 🔧 **丰富的工具集**：文件读写、编辑、搜索、命令执行等
- 🌊 **流式输出**：实时显示 AI 响应，提升交互体验
- 🤖 **多模型支持**：支持 DeepSeek 和 OpenAI API
- 💬 **对话管理**：支持多轮对话、历史记录管理
- 🎨 **美观的 CLI**：彩色输出、工具调用提示

## 安装

```bash
# 克隆项目
git clone https://github.com/BlackCubeGithub/NotClaudeCode.git
cd NotClaudeCode

# 安装依赖
npm install

# 构建
npm run build
```

## 配置

创建 `.env` 文件并配置 API Key：

```bash
# 复制示例文件
cp .env.example .env
```

编辑 `.env` 文件：

```env
# OpenAI API (可选)
OPENAI_API_KEY=your_openai_api_key_here

# DeepSeek API (推荐)
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

## 使用

### 启动 CLI

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 指定提供商和模型
npm run dev -- --provider deepseek --model deepseek-chat
npm run dev -- -p openai -m gpt-4-turbo-preview
```

### CLI 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清除对话历史 |
| `/history` | 显示对话历史 |
| `/exit` 或 `/quit` | 退出程序 |

### 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--provider` | `-p` | AI 提供商 (openai, deepseek) | deepseek |
| `--model` | `-m` | AI 模型 | deepseek-chat |
| `--directory` | `-d` | 工作目录 | 当前目录 |

## 支持的工具

| 工具 | 说明 |
|------|------|
| `Read` | 读取文件内容 |
| `Write` | 写入文件 |
| `Edit` | 编辑文件（搜索替换） |
| `LS` | 列出目录内容 |
| `Glob` | 文件模式匹配 |
| `Grep` | 文件内容搜索 |
| `RunCommand` | 执行终端命令 |
| `CheckCommandStatus` | 检查命令状态 |
| `StopCommand` | 停止运行中的命令 |
| `TodoWrite` | 创建和管理任务列表 |
| `WebSearch` | 搜索互联网信息 |
| `WebFetch` | 获取网页内容 |

## 项目结构

```
NotClaudeCode/
├── src/
│   ├── ai/                    # AI 提供商
│   │   ├── openai-provider.ts
│   │   └── deepseek-provider.ts
│   ├── cli/                   # 命令行界面
│   ├── core/                  # 核心逻辑
│   │   └── agent.ts
│   ├── tools/                 # 工具实现
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── edit.ts
│   │   └── ...
│   ├── types/                 # 类型定义
│   └── cli.ts                 # 入口文件
├── dist/                      # 编译输出
├── package.json
└── tsconfig.json
```

## 开发

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 构建
npm run build
```

## 支持的模型

### DeepSeek (推荐)
- `deepseek-chat` - 通用对话模型
- `deepseek-coder` - 代码专用模型

### OpenAI
- `gpt-4-turbo-preview` - GPT-4 Turbo
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

## 许可证

MIT

## 致谢

本项目灵感来源于 Claude Code，仅供学习和研究目的。
