import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { OpenAIProvider, DeepSeekProvider, ZhipuProvider, QwenProvider, KimiProvider } from '../ai';
import { Agent, toolResultCleanup, getToolResultStats, estimateCompactSavings, layer3Compact, layer2Compact } from '../core';
import { SessionManager, Storage } from '../core';
import { AIProvider, DangerousToolCallback } from '../types';
import { setDebugMode, isDebugMode } from '../utils/debug';

function getPackageVersion(): string {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  }
}

export async function startCLI(): Promise<void> {
  loadEnvFile();

  const program = new Command();

  program
    .name('ncc')
    .description('NotClaudeCode - A Claude Code clone')
    .version(getPackageVersion())
    .option('-d, --directory <path>', 'Working directory', process.cwd())
    .option('-p, --provider <provider>', 'AI provider to use (openai, deepseek, zhipu, qwen, kimi)', 'deepseek')
    .option('-m, --model <model>', 'AI model to use')
    .option('-s, --session <id>', 'Session ID to resume')
    .option('--new-session', 'Start a new session', false)
    .option('--debug', 'Enable debug mode', false)
    .parse(process.argv);

  const options = program.opts();
  setDebugMode(options.debug || false);
  const workingDirectory = path.resolve(options.directory);
  const providerName = options.provider.toLowerCase();
  const defaultModels: Record<string, string> = {
    openai: 'gpt-4-turbo-preview',
    deepseek: 'deepseek-chat',
    zhipu: 'glm-4-flash',
    qwen: 'qwen-turbo',
    kimi: 'moonshot-v1-8k',
  };
  const model = options.model || defaultModels[providerName] || 'deepseek-chat';

  const apiKeys: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    qwen: process.env.QWEN_API_KEY,
    kimi: process.env.KIMI_API_KEY,
  };

  const apiKey = apiKeys[providerName];
  if (!apiKey) {
    const keyNames: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      qwen: 'QWEN_API_KEY',
      kimi: 'KIMI_API_KEY',
    };
    const keyName = keyNames[providerName] || 'API_KEY';
    console.error(chalk.red(`Error: ${keyName} environment variable is not set.`));
    console.error(chalk.yellow('Please set it in your environment or create a .env file.'));
    process.exit(1);
  }

  let provider: AIProvider;
  switch (providerName) {
    case 'openai':
      provider = new OpenAIProvider(apiKey, model);
      break;
    case 'deepseek':
      provider = new DeepSeekProvider(apiKey, model);
      break;
    case 'zhipu':
      provider = new ZhipuProvider(apiKey, model);
      break;
    case 'qwen':
      provider = new QwenProvider(apiKey, model);
      break;
    case 'kimi':
      provider = new KimiProvider(apiKey, model);
      break;
    default:
      console.error(chalk.red(`Unknown provider: ${providerName}`));
      console.error(chalk.yellow('Available providers: openai, deepseek, zhipu, qwen, kimi'));
      process.exit(1);
  }

  const storage = new Storage();
  const sessionManager = new SessionManager(storage);

  let sessionId: string | undefined = options.session;
  
  if (!options.newSession && !sessionId) {
    const lastSession = storage.getLastActiveSession();
    if (lastSession && storage.sessionExists(lastSession)) {
      const sessions = storage.listSessions();
      const lastSessionInfo = sessions.find(s => s.id === lastSession);
      if (lastSessionInfo) {
        console.log(chalk.cyan(`\n📂 Found previous session: ${lastSessionInfo.title || 'Untitled'}`));
        console.log(chalk.gray(`   Updated: ${new Date(lastSessionInfo.updatedAt).toLocaleString()}`));
        console.log(chalk.gray(`   Messages: ${lastSessionInfo.messageCount}`));
        
        const { resume } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'resume',
            message: 'Resume this session?',
            default: true,
          },
        ]);
        
        if (resume) {
          sessionId = lastSession;
        }
      }
    }
  }

  if (sessionId) {
    const loaded = await sessionManager.loadSession(sessionId);
    if (!loaded) {
      console.log(chalk.yellow(`Session ${sessionId} not found. Creating new session.`));
      sessionId = undefined;
    }
  }

  if (!sessionId) {
    sessionId = await sessionManager.createSession(providerName, model, workingDirectory);
    console.log(chalk.gray(`\n📁 Created new session: ${sessionId}`));
  }

  const agent = new Agent(provider, workingDirectory, true, sessionManager);

  const metadata = sessionManager.getMetadata();
  console.log(chalk.cyan.bold('\n🚀 NotClaudeCode v' + getPackageVersion()));
  console.log(chalk.gray('Provider: ' + providerName));
  console.log(chalk.gray('Working directory: ' + workingDirectory));
  console.log(chalk.gray('Model: ' + model));
  console.log(chalk.gray('Session: ' + (metadata?.title || sessionId?.substring(0, 8) || 'N/A')));
  if (isDebugMode()) {
    console.log(chalk.yellow('Debug mode: ENABLED'));
  }
  console.log(chalk.gray('Type your message and press Enter. Type /help for commands.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = chalk.green('You: ');

  const askQuestion = () => {
    rl.question(prompt, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.startsWith('/')) {
        const handled = await handleSlashCommand(trimmed, agent, sessionManager, rl);
        if (!handled) {
          askQuestion();
          return;
        }
        if (handled === 'exit') {
          rl.close();
          return;
        }
        askQuestion();
        return;
      }

      console.log(chalk.blue('\n🤖 Assistant:'));

      try {
        const dangerousToolCallback: DangerousToolCallback = async ({ toolName, params, reason }) => {
          console.log(chalk.red(`\n⚠️  DANGEROUS OPERATION DETECTED\n`));
          console.log(chalk.yellow(`Tool: ${toolName}`));
          console.log(chalk.yellow(`Reason: ${reason}`));
          console.log(chalk.gray(`Parameters: ${JSON.stringify(params, null, 2)}`));
          console.log();

          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Do you want to proceed?',
              default: false,
            },
          ]);
          return confirm;
        };

        const stream = agent.processUserMessageStream(trimmed, (toolName, params) => {
          console.log(chalk.yellow(`\n🔧 Calling tool: ${toolName}`));
          if (Object.keys(params).length > 0) {
            console.log(chalk.gray(`   Parameters: ${JSON.stringify(params, null, 2).substring(0, 200)}...`));
          }
        }, dangerousToolCallback);

        process.stdout.write(chalk.white(''));
        
        for await (const chunk of stream) {
          if (chunk.type === 'content' && chunk.content) {
            process.stdout.write(chunk.content);
          }
        }
        
        console.log('\n');
        
        const usagePercent = agent.getContextUsagePercent();
        if (usagePercent > 70) {
          console.log(chalk.yellow(`⚠️ Context usage: ${usagePercent}%`));
          if (usagePercent > 85) {
            console.log(chalk.yellow('   Consider using /compact to compress context.'));
          }
        }
      } catch (error) {
        console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : String(error))));
        console.log();
      }

      askQuestion();
    });
  };

  askQuestion();
}

async function handleSlashCommand(
  command: string,
  agent: Agent,
  sessionManager: SessionManager,
  rl: readline.Interface
): Promise<void | 'exit'> {
  const parts = command.slice(1).split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      console.log(chalk.cyan('\n📚 Available commands:\n'));
      console.log(chalk.white('  General:'));
      console.log('    /help              - Show this help message');
      console.log('    /clear             - Clear conversation history');
      console.log('    /history           - Show conversation history');
      console.log('    /context           - Show context usage statistics');
      console.log('    /memory            - Show session memory summary');
      console.log('    /compact           - Clean up tool results to save context');
      console.log('    /config            - Show and reload project configuration');
      console.log('    /exit, /quit       - Exit the program\n');
      console.log(chalk.white('  Session:'));
      console.log('    /session           - Show current session info');
      console.log('    /session new       - Create a new session');
      console.log('    /session new -n <name> - Create named session');
      console.log('    /session list      - List all sessions');
      console.log('    /session switch    - Switch to another session');
      console.log('    /session title <n> - Set session title');
      console.log('    /session delete    - Delete a session\n');
      console.log(chalk.white('  Skills:'));
      console.log('    /skill             - List all available skills');
      console.log('    /skill <name>      - Show skill details');
      console.log('    /skill run <name>  - Execute a skill\n');
      console.log(chalk.white('  Checkpoint:'));
      console.log('    /checkpoint        - Create a checkpoint');
      console.log('    /checkpoint -n <name> - Create named checkpoint');
      console.log('    /checkpoint list   - List checkpoints');
      console.log('    /checkpoint <id>   - Restore to checkpoint');
      console.log('    /checkpoint delete - Delete a checkpoint\n');
      return;

    case 'clear':
      agent.clearHistory();
      console.log(chalk.green('Conversation history cleared.\n'));
      return;

    case 'history': {
      const history = agent.getConversationHistory();
      console.log(chalk.cyan('\n📜 Conversation History:\n'));
      history.forEach((msg, index) => {
        if (msg.role === 'system') return;
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const content = msg.content?.substring(0, 100) || '[tool call]';
        console.log(chalk.gray(`[${index}] ${role}: ${content}...`));
      });
      console.log();
      return;
    }

    case 'context': {
      const stats = agent.getContextStats();
      const limit = agent.getContextLimit();
      const usagePercent = agent.getContextUsagePercent();
      
      console.log(chalk.cyan('\n📊 Context Usage Statistics\n'));
      console.log(chalk.white(`Total Tokens: ${stats.totalTokens.toLocaleString()} / ${limit.toLocaleString()}`));
      
      const usageBar = '█'.repeat(Math.ceil(usagePercent / 5)) + '░'.repeat(20 - Math.ceil(usagePercent / 5));
      const usageColor = usagePercent > 80 ? chalk.red : usagePercent > 60 ? chalk.yellow : chalk.green;
      console.log(usageColor(`[${usageBar}] ${usagePercent}%`));
      
      console.log(chalk.white(`Total Characters: ${stats.totalChars.toLocaleString()}`));
      console.log(chalk.white(`Total Messages: ${stats.messageCount.total}`));
      console.log();
      console.log(chalk.cyan('Token Breakdown by Role:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const roleLabels: Record<string, { icon: string; color: (s: string) => string }> = {
        system: { icon: '⚙️', color: chalk.magenta },
        user: { icon: '👤', color: chalk.green },
        assistant: { icon: '🤖', color: chalk.blue },
        tool: { icon: '🔧', color: chalk.yellow },
      };

      for (const [role, data] of Object.entries(stats.breakdown)) {
        const label = roleLabels[role];
        const bar = '█'.repeat(Math.ceil(data.percentage / 5));
        console.log(
          `  ${label.icon} ${label.color(role.padEnd(10))} ` +
          `${data.tokens.toLocaleString().padStart(6)} tokens ` +
          `(${data.percentage.toString().padStart(3)}%) ` +
          chalk.gray(bar)
        );
      }
      
      console.log(chalk.gray('─'.repeat(50)));
      console.log();
      return;
    }

    case 'memory':
      return handleMemoryCommand(agent, sessionManager);

    case 'compact':
      await handleCompactCommand(agent, sessionManager, rl);
      return;

    case 'config':
      await handleConfigCommand(agent);
      return;

    case 'session':
      await handleSessionCommand(args, agent, sessionManager, rl);
      return;

    case 'skill':
    case 'skills':
      await handleSkillCommand(args, agent, rl);
      return;

    case 'checkpoint':
      await handleCheckpointCommand(args, agent, sessionManager, rl);
      return;

    case 'exit':
    case 'quit':
      console.log(chalk.cyan('\nGoodbye! 👋\n'));
      rl.close();
      return 'exit';

    default:
      console.log(chalk.yellow(`Unknown command: ${cmd}. Type /help for available commands.\n`));
      return;
  }
}

async function handleSessionCommand(
  args: string[],
  agent: Agent,
  sessionManager: SessionManager,
  rl: readline.Interface
): Promise<void> {
  const subCmd = args[0]?.toLowerCase();

  switch (subCmd) {
    case 'new': {
      let customTitle: string | undefined;
      const titleIndex = args.indexOf('-n');
      if (titleIndex !== -1 && args[titleIndex + 1]) {
        customTitle = args[titleIndex + 1];
      }
      const metadata = sessionManager.getMetadata();
      const newId = await sessionManager.createSession(
        metadata?.provider || 'deepseek',
        metadata?.model || 'deepseek-chat',
        metadata?.workingDirectory || process.cwd(),
        customTitle
      );
      agent.clearHistory();
      console.log(chalk.green(`\n✅ Created new session: ${customTitle || newId}\n`));
      return;
    }

    case 'delete': {
      const currentSessionId = sessionManager.getCurrentSessionId();
      const sessionsToDelete = sessionManager.listSessions().filter(s => s.id !== currentSessionId);
      if (sessionsToDelete.length === 0) {
        console.log(chalk.yellow('No other sessions to delete. Cannot delete the current session.\n'));
        return;
      }
      rl.pause();
      const { selectedSession } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSession',
          message: 'Select a session to delete:',
          choices: sessionsToDelete.slice(0, 20).map(s => ({
            name: `${s.title || 'Untitled'} (${s.id.substring(0, 8)})`,
            value: s.id,
          })),
        },
      ]);
      if (selectedSession) {
        const { confirmDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: `Delete session ${selectedSession.substring(0, 8)}? This cannot be undone.`,
            default: false,
          },
        ]);
        if (confirmDelete) {
          await sessionManager.deleteSession(selectedSession);
          console.log(chalk.green('\n✅ Session deleted.\n'));
        } else {
          console.log(chalk.gray('Deletion cancelled.\n'));
        }
      }
      rl.resume();
      return;
    }

    case 'list': {
      const sessions = sessionManager.listSessions();
      console.log(chalk.cyan('\n📁 Sessions:\n'));
      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions found.'));
      } else {
        sessions.slice(0, 10).forEach((s, _i) => {
          const current = s.id === sessionManager.getCurrentSessionId() ? chalk.green('●') : ' ';
          const date = new Date(s.updatedAt).toLocaleDateString();
          console.log(`  ${current} ${chalk.white(s.id.substring(0, 8))} - ${s.title || 'Untitled'}`);
          console.log(`      ${chalk.gray(`${date} | ${s.messageCount} messages | ${s.tokenCount} tokens`)}`);
        });
        if (sessions.length > 10) {
          console.log(chalk.gray(`\n  ... and ${sessions.length - 10} more`));
        }
      }
      console.log();
      return;
    }

    case 'switch': {
      const sessionsToSwitch = sessionManager.listSessions();
      if (sessionsToSwitch.length === 0) {
        console.log(chalk.yellow('No sessions available.\n'));
        return;
      }
      rl.pause();
      const { selectedSession } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSession',
          message: 'Select a session:',
          choices: sessionsToSwitch.slice(0, 20).map(s => ({
            name: `${s.title || 'Untitled'} (${new Date(s.updatedAt).toLocaleDateString()})`,
            value: s.id,
          })),
        },
      ]);
      rl.resume();
      if (selectedSession) {
        await sessionManager.loadSession(selectedSession);
        agent.setMessages(sessionManager.getMessages());
        console.log(chalk.green(`\n✅ Switched to session: ${selectedSession.substring(0, 8)}\n`));
      }
      return;
    }

    case 'title': {
      const title = args.slice(1).join(' ');
      if (!title) {
        console.log(chalk.yellow('Usage: /session title <title>\n'));
        return;
      }
      sessionManager.setTitle(title);
      await sessionManager.saveSession();
      console.log(chalk.green(`\n✅ Session title set to: ${title}\n`));
      return;
    }

    case undefined:
    default: {
      const info = sessionManager.getMetadata();
      const stats = sessionManager.getStats();
      const agentStats = agent.getContextStats();
      const contextLimit = agent.getContextLimit();
      const contextPercent = agent.getContextUsagePercent();
      console.log(chalk.cyan('\n📁 Current Session:\n'));
      console.log(`  ID: ${chalk.white(info?.id || 'N/A')}`);
      console.log(`  Title: ${chalk.white(info?.title || 'Untitled')}`);
      console.log(`  Provider: ${chalk.white(info?.provider || 'N/A')}`);
      console.log(`  Model: ${chalk.white(info?.model || 'N/A')}`);
      console.log(`  Working Directory: ${chalk.white(info?.workingDirectory || 'N/A')}`);
      console.log(`  Created: ${chalk.white(new Date(info?.createdAt || '').toLocaleString())}`);
      console.log(`  Updated: ${chalk.white(new Date(info?.updatedAt || '').toLocaleString())}`);
      console.log(`  Messages: ${chalk.white(stats.messageCount.toString())}`);
      console.log(`  Tokens: ${chalk.white(agentStats.totalTokens.toLocaleString())} / ${contextLimit.toLocaleString()} (${Math.round(contextPercent)}%)`);
      console.log(`  Checkpoints: ${chalk.white(stats.checkpointCount.toString())}`);
      console.log();
      return;
    }
  }
}

async function handleCheckpointCommand(
  args: string[],
  agent: Agent,
  sessionManager: SessionManager,
  rl: readline.Interface
): Promise<void> {
  const subCmd = args[0]?.toLowerCase();

  switch (subCmd) {
    case 'list': {
      const checkpoints = sessionManager.getCheckpoints();
      console.log(chalk.cyan('\n🔖 Checkpoints:\n'));
      if (checkpoints.length === 0) {
        console.log(chalk.gray('  No checkpoints found.'));
      } else {
        checkpoints.forEach((cp, i) => {
          if (!cp || !cp.id) {
            console.log(chalk.yellow(`  [Invalid checkpoint at index ${i}]`));
            return;
          }
          const date = new Date(cp.timestamp).toLocaleString();
          console.log(`  ${chalk.white(cp.id.substring(0, 8))} - ${cp.description || 'Checkpoint'}`);
          console.log(`      ${chalk.gray(`${date} | ${cp.messageIndex} messages | ${cp.tokenCount} tokens`)}`);
        });
      }
      console.log();
      return;
    }

    case 'delete': {
      const checkpointsToDelete = sessionManager.getCheckpoints();
      if (checkpointsToDelete.length === 0) {
        console.log(chalk.yellow('No checkpoints to delete.\n'));
        return;
      }
      rl.pause();
      const { selectedCheckpoint } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedCheckpoint',
          message: 'Select a checkpoint to delete:',
          choices: checkpointsToDelete.map(cp => ({
            name: `${cp.description || 'Checkpoint'} (${cp.id.substring(0, 8)})`,
            value: cp.id,
          })),
        },
      ]);
      rl.resume();
      if (selectedCheckpoint) {
        sessionManager.deleteCheckpoint(selectedCheckpoint);
        console.log(chalk.green('\n✅ Checkpoint deleted.\n'));
      }
      return;
    }

    case undefined: {
      let description: string | undefined;
      const nameIndex = args.indexOf('-n');
      if (nameIndex !== -1 && args[nameIndex + 1]) {
        description = args[nameIndex + 1];
      } else if (args.length > 0) {
        description = args.join(' ');
      }
      const checkpoint = sessionManager.createCheckpoint(description, 'manual');
      if (checkpoint) {
        console.log(chalk.green(`\n✅ Checkpoint created: ${description || checkpoint.id.substring(0, 8)}\n`));
      } else {
        console.log(chalk.yellow('Failed to create checkpoint.\n'));
      }
      return;
    }

    default: {
      const checkpointId = subCmd;
      const checkpointsToRestore = sessionManager.getCheckpoints();
      const found = checkpointsToRestore.find(cp => cp.id.startsWith(checkpointId));
      if (!found) {
        console.log(chalk.yellow(`Checkpoint not found: ${checkpointId}\n`));
        return;
      }
      rl.pause();
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Restore to checkpoint ${found.id.substring(0, 8)}?`,
          default: true,
        },
      ]);
      rl.resume();
      if (confirm) {
        const success = await sessionManager.restoreCheckpoint(found.id);
        if (success) {
          agent.setMessages(sessionManager.getMessages());
          console.log(chalk.green(`\n✅ Restored to checkpoint: ${found.id.substring(0, 8)}\n`));
        } else {
          console.log(chalk.yellow('Failed to restore checkpoint.\n'));
        }
      }
      return;
    }
  }
}

function handleMemoryCommand(
  agent: Agent,
  sessionManager: SessionManager
): void {
  const memory = sessionManager.getSessionMemory();
  
  console.log(chalk.cyan('\n🧠 Session Memory\n'));
  
  if (memory.projectOverview) {
    console.log(chalk.white('Project Overview:'));
    console.log(chalk.gray(`  ${memory.projectOverview.substring(0, 200)}${memory.projectOverview.length > 200 ? '...' : ''}`));
    console.log();
  }
  
  if (memory.completedTasks.length > 0) {
    console.log(chalk.white('Completed Tasks:'));
    memory.completedTasks.slice(-5).forEach((task, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`));
    });
    console.log();
  }
  
  if (memory.keyDecisions.length > 0) {
    console.log(chalk.white('Key Decisions:'));
    memory.keyDecisions.slice(-5).forEach((decision, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${decision.substring(0, 100)}${decision.length > 100 ? '...' : ''}`));
    });
    console.log();
  }
  
  if (memory.importantFiles.length > 0) {
    console.log(chalk.white('Important Files:'));
    memory.importantFiles.slice(-10).forEach((file) => {
      console.log(chalk.gray(`  - ${file}`));
    });
    console.log();
  }
  
  if (memory.problemsAndSolutions.length > 0) {
    console.log(chalk.white('Problems & Solutions:'));
    memory.problemsAndSolutions.slice(-5).forEach((ps, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${ps.substring(0, 100)}${ps.length > 100 ? '...' : ''}`));
    });
    console.log();
  }
  
  console.log(chalk.white('Current State:'));
  console.log(chalk.gray(`  ${memory.currentState.substring(0, 150)}${memory.currentState.length > 150 ? '...' : ''}`));
  console.log();
  
  console.log(chalk.gray(`Last Updated: ${new Date(memory.lastUpdated).toLocaleString()}`));
  console.log();
}

async function handleCompactCommand(
  agent: Agent,
  sessionManager: SessionManager,
  rl: readline.Interface
): Promise<void> {
  const messages = agent.getConversationHistory();
  const contextLimit = agent.getContextLimit();
  const toolStats = getToolResultStats(messages);
  const estimates = estimateCompactSavings(messages, contextLimit);

  console.log(chalk.cyan('\n🗜️ Context Compression\n'));
  
  console.log(chalk.white('Context Status:'));
  console.log(`  Current: ${estimates.currentTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens`);
  console.log(`  Usage: ${Math.round(estimates.currentUsage * 100)}%`);
  console.log();
  
  console.log(chalk.white('Tool Result Statistics:'));
  console.log(`  Count: ${toolStats.count}`);
  console.log(`  Total Tokens: ${toolStats.totalTokens.toLocaleString()}`);
  console.log();

  if (estimates.currentUsage < 0.5) {
    console.log(chalk.green('✓ Context usage is healthy (< 50%). No compression needed.\n'));
    return;
  }

  rl.pause();
  const { compactLevel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'compactLevel',
      message: 'Select compression level:',
      choices: [
        { name: 'Layer 1: Tool result cleanup (fastest)', value: 'layer1' },
        { name: 'Layer 2: Session memory compression', value: 'layer2' },
        { name: 'Layer 3: AI-powered summary (most aggressive)', value: 'layer3' },
        { name: 'Cancel', value: 'cancel' },
      ],
      default: estimates.currentUsage >= 0.95 ? 'layer3' : 
               estimates.currentUsage >= 0.85 ? 'layer2' : 'layer1',
    },
  ]);
  rl.resume();

  if (compactLevel === 'cancel') {
    console.log(chalk.gray('Compression cancelled.\n'));
    return;
  }

  if (compactLevel === 'layer1') {
    if (toolStats.count === 0) {
      console.log(chalk.yellow('⚠️ No tool results to clean. Try Layer 2 or 3 instead.\n'));
      return;
    }

    const result = toolResultCleanup(messages, contextLimit, 0.7);

    if (result.triggered) {
      agent.setMessages(result.messages);
      sessionManager.setMessages(result.messages);
      await sessionManager.saveSession();

      const savedTokens = result.tokensBefore - result.tokensAfter;
      console.log(chalk.green('\n✅ Layer 1 Compression complete!'));
      console.log(`  Tool results cleaned: ${result.toolResultsCleaned}`);
      console.log(`  Saved: ${savedTokens.toLocaleString()} tokens\n`);
    } else {
      console.log(chalk.yellow(`\n${result.reason || 'No compression performed.'}\n`));
    }
    return;
  }

  if (compactLevel === 'layer2') {
    const memory = sessionManager.getSessionMemory();
    const result = layer2Compact(messages, contextLimit, memory);

    agent.setMessages(result.messages);
    sessionManager.setMessages(result.messages);
    sessionManager.setSessionMemory(result.memory);
    await sessionManager.saveSession();

    console.log(chalk.green('\n✅ Layer 2 Compression complete!'));
    console.log(`  Messages summarized: ${result.messagesSummarized}`);
    console.log(`  Saved: ${result.tokensSaved.toLocaleString()} tokens\n`);
    return;
  }

  if (compactLevel === 'layer3') {
    console.log(chalk.gray('\nGenerating AI summary (this may take a moment)...\n'));
    
    const provider = agent.getProvider();
    const result = await layer3Compact(messages, provider, contextLimit, 5);

    if (result.tokensSaved > 0) {
      agent.setMessages(result.messages);
      sessionManager.setMessages(result.messages);
      await sessionManager.saveSession();

      console.log(chalk.green('\n✅ Layer 3 Compression complete!'));
      console.log(`  Messages summarized: ${result.messagesSummarized}`);
      console.log(`  Saved: ${result.tokensSaved.toLocaleString()} tokens\n`);
      
      if (result.summary) {
        console.log(chalk.white('Summary preview:'));
        console.log(chalk.gray(result.summary.substring(0, 300) + '...\n'));
      }
    } else {
      console.log(chalk.yellow('\nLayer 3 compression failed or no savings achieved.\n'));
    }
    return;
  }
}

async function handleConfigCommand(
  agent: Agent
): Promise<void> {
  const configManager = agent.getConfigManager();
  const result = configManager.reload();
  const config = result.config;

  console.log(chalk.cyan('\n⚙️  Project Configuration\n'));

  if (result.sources.length === 0) {
    console.log(chalk.yellow('  No configuration file found for this project.'));
    console.log(chalk.gray('  Create NOTCLAUDECODE.md or .notclaudecode.json in your project root.\n'));
    return;
  }

  console.log(chalk.gray('  Config sources:'));
  for (const src of result.sources) {
    const relPath = src.path.replace(process.cwd(), '.');
    console.log(chalk.gray(`    - ${relPath}`));
  }
  console.log();

  if (result.errors.length > 0) {
    console.log(chalk.red('  Errors:'));
    for (const err of result.errors) {
      console.log(chalk.red(`    - ${err}`));
    }
    console.log();
  }

  const sections: string[] = [];

  if (config.overview) {
    sections.push(chalk.white('Overview:') + '\n  ' + chalk.gray(config.overview));
  }

  if (config.languages && config.languages.length > 0) {
    sections.push(chalk.white('Languages:') + '\n  ' + config.languages.join(', '));
  }

  if (config.codeStyle) {
    sections.push(chalk.white('Code Style:') + '\n  ' + chalk.gray(config.codeStyle));
  }

  if (config.commands && Object.keys(config.commands).length > 0) {
    const cmdLines = Object.entries(config.commands)
      .map(([alias, cmd]) => `  ${chalk.yellow(alias)}: ${chalk.gray(cmd)}`)
      .join('\n');
    sections.push(chalk.white('Commands:') + '\n' + cmdLines);
  }

  if (config.rules && config.rules.length > 0) {
    const ruleLines = config.rules.map((r) => `  - ${r}`).join('\n');
    sections.push(chalk.white('Rules:') + '\n' + ruleLines);
  }

  if (config.forbidden && config.forbidden.length > 0) {
    const forbidLines = config.forbidden
      .map((f) => `  - ${chalk.red(f.name)}: ${f.message}`)
      .join('\n');
    sections.push(chalk.white('Forbidden:') + '\n' + forbidLines);
  }

  if (config.checks && config.checks.length > 0) {
    const checkLines = config.checks
      .map((c) => `  [${c.required ? 'REQUIRED' : 'OPTIONAL'}] ${c.type}: ${chalk.gray(c.command)}`)
      .join('\n');
    sections.push(chalk.white('Checks:') + '\n' + checkLines);
  }

  if (sections.length === 0) {
    console.log(chalk.gray('  No configuration content loaded.\n'));
  } else {
    console.log(sections.join('\n\n'));
  }

  console.log(chalk.gray('  Reload with /config reload\n'));
}

async function handleSkillCommand(
  args: string[],
  agent: Agent,
  rl: readline.Interface
): Promise<void> {
  const skillManager = agent.getSkillManager();
  const subCmd = args[0]?.toLowerCase();

  if (!subCmd || subCmd === 'list') {
    const skills = skillManager.getAllSkills();
    console.log(chalk.cyan('\n🎯 Available Skills:\n'));
    
    if (skills.length === 0) {
      console.log(chalk.gray('  No skills available.'));
      console.log(chalk.gray('\n  Skills can be added by:'));
      console.log(chalk.gray('  - Creating SKILL.md in your project root'));
      console.log(chalk.gray('  - Adding .claude/skills/*.md files'));
      console.log(chalk.gray('  - Adding skills to ~/.notclaude/skills/\n'));
      return;
    }

    const grouped: Record<string, typeof skills> = {
      'built-in': [],
      'project': [],
      'user': [],
    };

    for (const skill of skills) {
      grouped[skill.source].push(skill);
    }

    for (const [source, sourceSkills] of Object.entries(grouped)) {
      if (sourceSkills.length === 0) continue;
      
      console.log(chalk.white(`  ${source.charAt(0).toUpperCase() + source.slice(1)}:`));
      for (const skill of sourceSkills) {
        const desc = skill.description.split('\n')[0].substring(0, 50);
        const cmd = skill.trigger?.command || '';
        console.log(`    ${chalk.green(skill.name)} ${cmd ? chalk.gray(`(${cmd})`) : ''}`);
        console.log(`      ${chalk.gray(desc)}${desc.length >= 50 ? '...' : ''}`);
      }
      console.log();
    }
    return;
  }

  if (subCmd === 'run') {
    const skillName = args.slice(1).join(' ');
    if (!skillName) {
      console.log(chalk.yellow('Usage: /skill run <skill-name>\n'));
      return;
    }

    const skill = skillManager.getSkill(skillName);
    if (!skill) {
      console.log(chalk.red(`Skill not found: ${skillName}\n`));
      return;
    }

    console.log(chalk.cyan(`\n🎯 Executing skill: ${skill.name}\n`));
    console.log(chalk.gray(`Description: ${skill.description.split('\n')[0]}`));
    console.log(chalk.gray(`Steps: ${skill.steps.length}\n`));

    const variables: Record<string, string> = {};
    if (skill.variables && skill.variables.length > 0) {
      rl.pause();
      for (const variable of skill.variables) {
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `${variable.description || variable.name}:`,
            default: variable.default,
          },
        ]);
        variables[variable.name] = value;
      }
      rl.resume();
    }

    try {
      const result = await skillManager.executeSkill(skill.name, variables);
      
      if (result.success) {
        console.log(chalk.green('\n✅ Skill executed successfully!'));
        console.log(chalk.white(`Steps completed: ${result.stepsExecuted}/${skill.steps.length}`));
        if (result.output) {
          console.log(chalk.gray('\nOutput:'));
          console.log(result.output);
        }
      } else {
        console.log(chalk.red('\n❌ Skill execution failed'));
        console.log(chalk.white(`Steps completed: ${result.stepsExecuted}/${skill.steps.length}`));
        for (const error of result.errors) {
          console.log(chalk.red(`  Step ${error.step}: ${error.error}`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
    }
    console.log();
    return;
  }

  const skill = skillManager.getSkill(subCmd);
  if (!skill) {
    const skillNameWithSpaces = args.join(' ');
    if (skillNameWithSpaces) {
      const matched = skillManager.getSkill(skillNameWithSpaces);
      if (matched) {
        console.log(chalk.cyan(`\n🎯 Skill: ${matched.name}\n`));
        console.log(chalk.white('Description:'));
        console.log(chalk.gray(`  ${matched.description}`));
        console.log();
        console.log(chalk.white('Source:'), chalk.gray(matched.source));
        if (matched.trigger?.command) {
          console.log(chalk.white('Command:'), chalk.gray(matched.trigger.command));
        }
        if (matched.trigger?.filePattern) {
          console.log(chalk.white('File Pattern:'), chalk.gray(matched.trigger.filePattern));
        }
        if (matched.variables && matched.variables.length > 0) {
          console.log(chalk.white('\nVariables:'));
          for (const v of matched.variables) {
            const req = v.required ? chalk.red('*') : '';
            console.log(`  ${chalk.green(v.name)}${req}: ${chalk.gray(v.description || 'No description')}`);
          }
        }
        console.log(chalk.white('\nSteps:'));
        matched.steps.forEach((step, i) => {
          const desc = step.description || step.prompt || step.tool || 'Unknown step';
          console.log(`  ${i + 1}. ${chalk.gray(`[${step.type}]`)} ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
        });
        console.log();
        return;
      }
    }

    console.log(chalk.yellow(`Unknown skill: ${subCmd}`));
    console.log(chalk.gray('Use /skill to list available skills.\n'));
    return;
  }

  console.log(chalk.cyan(`\n🎯 Skill: ${skill.name}\n`));
  console.log(chalk.white('Description:'));
  console.log(chalk.gray(`  ${skill.description}`));
  console.log();
  console.log(chalk.white('Source:'), chalk.gray(skill.source));
  if (skill.trigger?.command) {
    console.log(chalk.white('Command:'), chalk.gray(skill.trigger.command));
  }
  if (skill.trigger?.filePattern) {
    console.log(chalk.white('File Pattern:'), chalk.gray(skill.trigger.filePattern));
  }
  if (skill.variables && skill.variables.length > 0) {
    console.log(chalk.white('\nVariables:'));
    for (const v of skill.variables) {
      const req = v.required ? chalk.red('*') : '';
      console.log(`  ${chalk.green(v.name)}${req}: ${chalk.gray(v.description || 'No description')}`);
    }
  }
  console.log(chalk.white('\nSteps:'));
  skill.steps.forEach((step, i) => {
    const desc = step.description || step.prompt || step.tool || 'Unknown step';
    console.log(`  ${i + 1}. ${chalk.gray(`[${step.type}]`)} ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
  });
  console.log();
}
