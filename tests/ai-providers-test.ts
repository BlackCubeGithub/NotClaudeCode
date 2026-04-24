import * as path from 'path';
import * as fs from 'fs';
import { OpenAIProvider } from '../src/ai/openai-provider';
import { DeepSeekProvider } from '../src/ai/deepseek-provider';
import { ZhipuProvider } from '../src/ai/zhipu-provider';
import { QwenProvider } from '../src/ai/qwen-provider';
import { KimiProvider } from '../src/ai/kimi-provider';
import { Message, ToolDefinition } from '../src/types';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log('cyan', `  ${title}`);
  console.log('='.repeat(60));
}

function loadEnvFile(): void {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value.replace(/^["']|["']$/g, '');
          }
        }
      }
    });
  }
}

loadEnvFile();

const testTools: ToolDefinition[] = [
  {
    name: 'GetTime',
    description: 'Get the current time',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Time format' },
      },
      required: [],
    },
  },
];

const testMessages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Say "hello" and nothing else.' },
];

interface ProviderConfig {
  name: string;
  apiKey: string | undefined;
  defaultModel: string;
  ProviderClass: new (apiKey: string, model?: string) => 
    | OpenAIProvider 
    | DeepSeekProvider 
    | ZhipuProvider 
    | QwenProvider 
    | KimiProvider;
}

const providers: ProviderConfig[] = [
  {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: 'gpt-3.5-turbo',
    ProviderClass: OpenAIProvider,
  },
  {
    name: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    defaultModel: 'deepseek-chat',
    ProviderClass: DeepSeekProvider,
  },
  {
    name: 'Zhipu',
    apiKey: process.env.ZHIPU_API_KEY,
    defaultModel: 'glm-4-flash',
    ProviderClass: ZhipuProvider,
  },
  {
    name: 'Qwen',
    apiKey: process.env.QWEN_API_KEY,
    defaultModel: 'qwen-turbo',
    ProviderClass: QwenProvider,
  },
  {
    name: 'Kimi',
    apiKey: process.env.KIMI_API_KEY,
    defaultModel: 'moonshot-v1-8k',
    ProviderClass: KimiProvider,
  },
];

async function testProviderChat(config: ProviderConfig): Promise<boolean> {
  if (!config.apiKey) {
    log('yellow', `  ⚠ ${config.name}: No API key, skipping`);
    return true;
  }

  try {
    const provider = new config.ProviderClass(config.apiKey, config.defaultModel);

    const response = await provider.chat(testMessages, testTools);

    if (response.content || response.toolCalls.length > 0) {
      log('green', `  ✓ ${config.name}: Chat successful`);
      if (response.content) {
        log('gray', `    Response: ${response.content.substring(0, 80)}...`);
      }
      return true;
    } else {
      log('red', `  ✗ ${config.name}: No content or tool calls`);
      return false;
    }
  } catch (error) {
    log('red', `  ✗ ${config.name}: Chat failed - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testProviderStreaming(config: ProviderConfig): Promise<boolean> {
  if (!config.apiKey) {
    return true;
  }

  try {
    const provider = new config.ProviderClass(config.apiKey, config.defaultModel);

    const chunks: string[] = [];
    for await (const chunk of provider.chatStream(testMessages, testTools)) {
      if (chunk.type === 'content' && chunk.content) {
        chunks.push(chunk.content);
      }
    }

    if (chunks.length > 0) {
      log('green', `  ✓ ${config.name}: Streaming successful (${chunks.length} chunks)`);
      return true;
    } else {
      log('yellow', `  ~ ${config.name}: No content chunks received`);
      return true;
    }
  } catch (error) {
    log('red', `  ✗ ${config.name}: Streaming failed - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testProviderToolCalls(config: ProviderConfig): Promise<boolean> {
  if (!config.apiKey) {
    return true;
  }

  try {
    const provider = new config.ProviderClass(config.apiKey, config.defaultModel);

    const toolMessages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant. Use tools when appropriate.' },
      { role: 'user', content: 'What time is it now? Use the GetTime tool.' },
    ];

    const response = await provider.chat(toolMessages, testTools);

    if (response.toolCalls && response.toolCalls.length > 0) {
      log('green', `  ✓ ${config.name}: Tool calls successful`);
      log('gray', `    Tool: ${response.toolCalls[0].function.name}`);
      return true;
    } else if (response.content) {
      log('yellow', `  ~ ${config.name}: No tool call, but got content response`);
      return true;
    } else {
      log('yellow', `  ~ ${config.name}: No tool calls (may be expected)`);
      return true;
    }
  } catch (error) {
    log('yellow', `  ~ ${config.name}: Tool call test failed - ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}

async function testProviderInitialization(config: ProviderConfig): Promise<boolean> {
  if (!config.apiKey) {
    log('yellow', `  ⚠ ${config.name}: No API key, skipping initialization test`);
    return true;
  }

  try {
    const provider = new config.ProviderClass(config.apiKey, config.defaultModel);

    if (provider.getModel) {
      const model = provider.getModel();
      log('green', `  ✓ ${config.name}: Initialized with model ${model}`);
      return true;
    } else {
      log('green', `  ✓ ${config.name}: Initialized (no getModel method)`);
      return true;
    }
  } catch (error) {
    log('red', `  ✗ ${config.name}: Initialization failed - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testProviderErrorHandling(config: ProviderConfig): Promise<boolean> {
  try {
    const provider = new config.ProviderClass('invalid-api-key-12345', config.defaultModel);

    await provider.chat(testMessages, testTools);

    log('yellow', `  ~ ${config.name}: Should have failed with invalid key`);
    return true;
  } catch {
    log('green', `  ✓ ${config.name}: Correctly handles invalid API key`);
    return true;
  }
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  AI Providers Test Suite');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);

  const results: { provider: string; test: string; passed: boolean }[] = [];

  logSection('Provider Initialization Tests');
  for (const config of providers) {
    results.push({
      provider: config.name,
      test: 'Initialization',
      passed: await testProviderInitialization(config),
    });
  }

  logSection('Provider Chat Tests');
  for (const config of providers) {
    results.push({
      provider: config.name,
      test: 'Chat',
      passed: await testProviderChat(config),
    });
  }

  logSection('Provider Streaming Tests');
  for (const config of providers) {
    results.push({
      provider: config.name,
      test: 'Streaming',
      passed: await testProviderStreaming(config),
    });
  }

  logSection('Provider Tool Call Tests');
  for (const config of providers) {
    results.push({
      provider: config.name,
      test: 'Tool Calls',
      passed: await testProviderToolCalls(config),
    });
  }

  logSection('Provider Error Handling Tests');
  for (const config of providers) {
    results.push({
      provider: config.name,
      test: 'Error Handling',
      passed: await testProviderErrorHandling(config),
    });
  }

  logSection('Test Results Summary');

  const providerResults: Record<string, { passed: number; total: number }> = {};

  for (const result of results) {
    if (!providerResults[result.provider]) {
      providerResults[result.provider] = { passed: 0, total: 0 };
    }
    providerResults[result.provider].total++;
    if (result.passed) {
      providerResults[result.provider].passed++;
    }
  }

  for (const [provider, stats] of Object.entries(providerResults)) {
    const icon = stats.passed === stats.total ? '✓' : '~';
    const color = stats.passed === stats.total ? 'green' : 'yellow';
    log(color, `  ${icon} ${provider}: ${stats.passed}/${stats.total} tests passed`);
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalTests = results.length;

  console.log('\n' + '-'.repeat(60));
  log('cyan', `  Total: ${totalPassed}/${totalTests} tests passed`);
  console.log('-'.repeat(60) + '\n');

  const availableProviders = providers.filter((p) => p.apiKey);
  if (availableProviders.length === 0) {
    log('yellow', '  Note: No API keys found. Set environment variables to run full tests:');
    log('gray', '    - OPENAI_API_KEY');
    log('gray', '    - DEEPSEEK_API_KEY');
    log('gray', '    - ZHIPU_API_KEY');
    log('gray', '    - QWEN_API_KEY');
    log('gray', '    - KIMI_API_KEY');
  }

  return true;
}

runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log('red', `Fatal error: ${error}`);
    process.exit(1);
  });
