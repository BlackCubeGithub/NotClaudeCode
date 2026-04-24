# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-23

### Added
- **Four-Layer Compression Architecture** (Layer 0-3) for intelligent context management
  - Layer 0: Normal operation (< 70% usage)
  - Layer 1: Tool result cleanup (70-85% usage)
  - Layer 2: Session memory compression (85-95% usage)
  - Layer 3: AI summary compression (≥ 95% usage)
- **Session Persistence System** with multi-session management and checkpoint rollback
- **Intelligent Memory Extraction** for automatic recording of project summaries, tasks, decisions, and problem solutions
- **Extended CLI Commands**
  - `/memory` - View and manage session memory
  - `/compact` - Manually trigger context compression
  - `/session` - Session management commands (list, switch, delete)
  - `/checkpoint` - Create and restore conversation checkpoints
- **Auto-save and Auto-compact Mechanisms** integrated into Agent
- **ContextMonitor SubAgent** for real-time context usage monitoring
  - Automatic context usage detection
  - Smart compact trigger based on usage thresholds
  - Compact cooldown mechanism (5 seconds between compacts)
  - User-friendly compact notifications
- **Auto-Compact Testing Suite** with comprehensive test cases
  - Context usage detection tests
  - Compact trigger detection tests
  - Layer 1/2/3 compact execution tests
  - Compact notification format tests

### Changed
- Refactored core architecture for better session management
- Enhanced Agent with automatic context management
- Improved CLI user experience with new commands
- Added `getModel()` method to all AI providers for context limit detection
- Integrated ContextMonitor into Agent's main processing loop

### Technical Details
- Implemented `SessionManager` class for session lifecycle management
- Added `Storage` class for persistent data storage
- Created `memory.ts` module for intelligent memory extraction
- Enhanced `compact.ts` with three-layer compression strategies
- Integrated automatic compression triggers in Agent workflow

## [0.1.0] - 2026-04-20

### Added
- Initial release of NotClaudeCode
- **Core Features**
  - Multi-provider AI support (OpenAI, DeepSeek, Zhipu, Qwen, Kimi)
  - Streaming output for real-time AI responses
  - Beautiful CLI interface with colored output and progress indicators
- **File Operations**
  - Read files from filesystem
  - Write files to filesystem
  - Edit existing files using search and replace
  - List directory contents
  - Find files matching patterns (Glob)
- **Code Search**
  - Search file contents with regex support (Grep)
- **Command Execution**
  - Execute terminal commands
  - Check status of running commands
  - Stop running commands
- **Task Management**
  - Create and manage task lists (TodoWrite)
- **Network Features**
  - Search the internet using Tavily AI (WebSearch)
  - Fetch and convert web page content to markdown (WebFetch)
- **Utilities**
  - Get current date and time (GetTime)
- **Security**
  - Environment variable based API key management
  - No hardcoded secrets in code
  - Input validation for tool parameters

### Technical Stack
- TypeScript 5.3 with strict mode
- Node.js >= 18.0.0
- Commander.js for CLI framework
- Chalk for terminal colors
- Ora for loading animations
- Inquirer for interactive prompts

