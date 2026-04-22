import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { OpenAIProvider, DeepSeekProvider, ZhipuProvider, QwenProvider, KimiProvider } from '../ai';
import { Agent } from '../core';
import { AIProvider } from '../types';
import { setDebugMode, isDebugMode } from '../utils/debug';

const PACKAGE_VERSION = '0.1.0';

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
    .version(PACKAGE_VERSION)
    .option('-d, --directory <path>', 'Working directory', process.cwd())
    .option('-p, --provider <provider>', 'AI provider to use (openai, deepseek, zhipu, qwen, kimi)', 'deepseek')
    .option('-m, --model <model>', 'AI model to use')
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
  const agent = new Agent(provider, workingDirectory);

  console.log(chalk.cyan.bold('\n🚀 NotClaudeCode v' + PACKAGE_VERSION));
  console.log(chalk.gray('Provider: ' + providerName));
  console.log(chalk.gray('Working directory: ' + workingDirectory));
  console.log(chalk.gray('Model: ' + model));
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
        const handled = await handleSlashCommand(trimmed, agent, rl);
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
        const stream = agent.processUserMessageStream(trimmed, (toolName, params) => {
          console.log(chalk.yellow(`\n🔧 Calling tool: ${toolName}`));
          if (Object.keys(params).length > 0) {
            console.log(chalk.gray(`   Parameters: ${JSON.stringify(params, null, 2).substring(0, 200)}...`));
          }
        });

        process.stdout.write(chalk.white(''));
        
        for await (const chunk of stream) {
          if (chunk.type === 'content' && chunk.content) {
            process.stdout.write(chunk.content);
          }
        }
        
        console.log('\n');
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
  rl: readline.Interface
): Promise<void | 'exit'> {
  const parts = command.slice(1).split(' ');
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case 'help':
      console.log(chalk.cyan('\nAvailable commands:'));
      console.log('  /help     - Show this help message');
      console.log('  /clear    - Clear conversation history');
      console.log('  /history  - Show conversation history');
      console.log('  /context  - Show context usage statistics');
      console.log('  /exit     - Exit the program');
      console.log('  /quit     - Exit the program\n');
      return;

    case 'clear':
      agent.clearHistory();
      console.log(chalk.green('Conversation history cleared.\n'));
      return;

    case 'history':
      const history = agent.getConversationHistory();
      console.log(chalk.cyan('\nConversation History:'));
      history.forEach((msg, index) => {
        if (msg.role === 'system') return;
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        console.log(chalk.gray(`[${index}] ${role}: ${msg.content?.substring(0, 100)}...`));
      });
      console.log();
      return;

    case 'context':
      const stats = agent.getContextStats();
      console.log(chalk.cyan('\n📊 Context Usage Statistics\n'));
      console.log(chalk.white(`Total Tokens: ${stats.totalTokens.toLocaleString()}`));
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
      console.log(chalk.cyan('Message Count by Role:'));
      console.log(chalk.gray('─'.repeat(50)));
      for (const [role, count] of Object.entries(stats.messageCount)) {
        if (role === 'total') continue;
        const label = roleLabels[role];
        console.log(`  ${label.icon} ${label.color(role.padEnd(10))} ${count} messages`);
      }
      console.log(chalk.gray('─'.repeat(50)));
      console.log();
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
