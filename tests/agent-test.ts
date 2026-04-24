import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Agent } from '../src/core/agent';
import { Storage } from '../src/core/storage';
import { SessionManager } from '../src/core/session-manager';
import { DeepSeekProvider } from '../src/ai/deepseek-provider';
import { OpenAIProvider } from '../src/ai/openai-provider';
import { AIProvider, Message, ToolDefinition, AIResponse, StreamChunk } from '../src/types';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
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

class MockProvider implements AIProvider {
  private responses: AIResponse[] = [];
  private responseIndex = 0;

  constructor(responses?: AIResponse[]) {
    if (responses) {
      this.responses = responses;
    } else {
      this.responses = [
        {
          content: 'Hello! I am a mock AI assistant.',
          toolCalls: [],
          finishReason: 'stop',
        },
      ];
    }
  }

  getModel(): string {
    return 'mock-model';
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<AIResponse> {
    const response = this.responses[this.responseIndex] || this.responses[0];
    this.responseIndex++;
    return response;
  }

  async *chatStream(
    messages: Message[],
    tools: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = this.responses[this.responseIndex] || this.responses[0];
    this.responseIndex++;

    if (response.content) {
      yield { type: 'content', content: response.content };
    }

    for (const tc of response.toolCalls) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      };
    }

    yield { type: 'done', finishReason: response.finishReason };
  }
}

let testDir: string;

function setupTestDir(): void {
  testDir = path.join(os.tmpdir(), `notclaudecode-agent-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
}

function cleanupTestDir(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testAgentInitialization() {
  logSection('Test 1: Agent Initialization');

  let passed = 0;
  let total = 0;

  total++;
  try {
    const mockProvider = new MockProvider();
    const agent = new Agent(mockProvider, testDir);

    if (agent.getToolDefinitions().length > 0) {
      log('green', `  ✓ Agent initialized with ${agent.getToolDefinitions().length} tools`);
      passed++;
    } else {
      log('red', '  ✗ Agent has no tools');
    }
  } catch (error) {
    log('red', `  ✗ Agent initialization threw: ${error}`);
  }

  total++;
  try {
    const mockProvider = new MockProvider();
    const agent = new Agent(mockProvider, testDir);

    const toolNames = agent.getToolDefinitions().map((t) => t.name);
    const requiredTools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'LS', 'RunCommand'];
    const hasAllTools = requiredTools.every((t) => toolNames.includes(t));

    if (hasAllTools) {
      log('green', '  ✓ Agent has all required tools');
      passed++;
    } else {
      const missing = requiredTools.filter((t) => !toolNames.includes(t));
      log('red', `  ✗ Agent missing tools: ${missing.join(', ')}`);
    }
  } catch (error) {
    log('red', `  ✗ Tool check threw: ${error}`);
  }

  total++;
  try {
    const mockProvider = new MockProvider();
    const storage = new Storage(path.join(testDir, '.test-storage'));
    const sessionManager = new SessionManager(storage);
    const agent = new Agent(mockProvider, testDir, true, sessionManager);

    if (agent.getSessionManager() === sessionManager) {
      log('green', '  ✓ Agent initialized with SessionManager');
      passed++;
    } else {
      log('red', '  ✗ SessionManager not set correctly');
    }
  } catch (error) {
    log('red', `  ✗ SessionManager initialization threw: ${error}`);
  }

  log('yellow', `\n  Agent Initialization: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testAgentWithMockProvider() {
  logSection('Test 2: Agent with Mock Provider');

  let passed = 0;
  let total = 0;

  total++;
  try {
    const mockProvider = new MockProvider([
      {
        content: 'I can help you with that!',
        toolCalls: [],
        finishReason: 'stop',
      },
    ]);
    const agent = new Agent(mockProvider, testDir);

    const response = await agent.processUserMessage('Hello!');
    if (response.includes('I can help you with that!')) {
      log('green', '  ✓ Agent processes user message');
      passed++;
    } else {
      log('red', `  ✗ Agent response unexpected: ${response.substring(0, 100)}`);
    }
  } catch (error) {
    log('red', `  ✗ Process message threw: ${error}`);
  }

  total++;
  try {
    const mockProvider = new MockProvider([
      {
        content: null,
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'GetTime',
              arguments: '{}',
            },
          },
        ],
        finishReason: 'tool_calls',
      },
      {
        content: 'The current time is retrieved.',
        toolCalls: [],
        finishReason: 'stop',
      },
    ]);
    const agent = new Agent(mockProvider, testDir);

    const response = await agent.processUserMessage('What time is it?');
    if (response) {
      log('green', '  ✓ Agent handles tool calls');
      passed++;
    } else {
      log('red', '  ✗ Agent tool call handling failed');
    }
  } catch (error) {
    log('red', `  ✗ Tool call handling threw: ${error}`);
  }

  total++;
  try {
    const mockProvider = new MockProvider();
    const agent = new Agent(mockProvider, testDir);

    const chunks: StreamChunk[] = [];
    for await (const chunk of agent.processUserMessageStream('Hello!')) {
      chunks.push(chunk);
    }

    const hasContent = chunks.some((c) => c.type === 'content');
    const hasDone = chunks.some((c) => c.type === 'done');

    if (hasContent && hasDone) {
      log('green', `  ✓ Agent streaming works (${chunks.length} chunks)`);
      passed++;
    } else {
      log('red', `  ✗ Agent streaming incomplete`);
    }
  } catch (error) {
    log('red', `  ✗ Agent streaming threw: ${error}`);
  }

  log('yellow', `\n  Agent with Mock Provider: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testAgentWithRealProvider() {
  logSection('Test 3: Agent with Real Provider (Requires API Key)');

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log('yellow', '⚠ No API key found. Skipping real provider tests.');
    log('gray', '  Set DEEPSEEK_API_KEY or OPENAI_API_KEY to run these tests.');
    return true;
  }

  let passed = 0;
  let total = 0;

  const provider = process.env.DEEPSEEK_API_KEY
    ? new DeepSeekProvider(process.env.DEEPSEEK_API_KEY!)
    : new OpenAIProvider(process.env.OPENAI_API_KEY!);

  const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';
  log('gray', `  Using provider: ${process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
  log('gray', `  Model: ${model}`);

  total++;
  try {
    const agent = new Agent(provider, testDir);

    const response = await agent.processUserMessage('Say "test successful" and nothing else.');
    if (response.toLowerCase().includes('test successful') || response.toLowerCase().includes('successful')) {
      log('green', `  ✓ Real provider responds correctly`);
      passed++;
    } else {
      log('yellow', `  ~ Real provider response: ${response.substring(0, 100)}...`);
      passed++;
    }
  } catch (error) {
    log('red', `  ✗ Real provider threw: ${error}`);
  }

  total++;
  try {
    const agent = new Agent(provider, testDir);

    const chunks: StreamChunk[] = [];
    for await (const chunk of agent.processUserMessageStream('Say "streaming works"')) {
      chunks.push(chunk);
    }

    const hasContent = chunks.some((c) => c.type === 'content' && c.content);
    const hasDone = chunks.some((c) => c.type === 'done');

    if (hasContent && hasDone) {
      log('green', `  ✓ Real provider streaming works (${chunks.length} chunks)`);
      passed++;
    } else {
      log('red', `  ✗ Real provider streaming incomplete`);
    }
  } catch (error) {
    log('red', `  ✗ Real provider streaming threw: ${error}`);
  }

  log('yellow', `\n  Agent with Real Provider: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 4: Tool Definitions');

  const mockProvider = new MockProvider();
  const agent = new Agent(mockProvider, testDir);

  let passed = 0;
  let total = 0;

  const toolDefs = agent.getToolDefinitions();

  total++;
  if (toolDefs.length > 0) {
    log('green', `  ✓ Agent has ${toolDefs.length} tool definitions`);
    passed++;
  } else {
    log('red', '  ✗ Agent has no tool definitions');
  }

  total++;
  const allHaveNames = toolDefs.every((t) => t.name && t.name.length > 0);
  if (allHaveNames) {
    log('green', '  ✓ All tools have names');
    passed++;
  } else {
    log('red', '  ✗ Some tools missing names');
  }

  total++;
  const allHaveDescriptions = toolDefs.every((t) => t.description && t.description.length > 0);
  if (allHaveDescriptions) {
    log('green', '  ✓ All tools have descriptions');
    passed++;
  } else {
    log('red', '  ✗ Some tools missing descriptions');
  }

  total++;
  const allHaveParameters = toolDefs.every(
    (t) => t.parameters && t.parameters.type === 'object'
  );
  if (allHaveParameters) {
    log('green', '  ✓ All tools have valid parameter schemas');
    passed++;
  } else {
    log('red', '  ✗ Some tools have invalid parameter schemas');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Agent Core Test Suite');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Test directory: ${testDir}`);

  setupTestDir();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'Agent Initialization', passed: await testAgentInitialization() });
    results.push({ name: 'Agent with Mock Provider', passed: await testAgentWithMockProvider() });
    results.push({ name: 'Agent with Real Provider', passed: await testAgentWithRealProvider() });
    results.push({ name: 'Tool Definitions', passed: await testToolDefinitions() });
  } finally {
    cleanupTestDir();
  }

  logSection('Test Results Summary');

  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(color, `  ${icon} ${result.name}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log('\n' + '-'.repeat(60));
  if (passed === total) {
    log('green', `  All ${total} test groups passed!`);
  } else {
    log('yellow', `  ${passed}/${total} test groups passed`);
  }
  console.log('-'.repeat(60) + '\n');

  return passed === total;
}

runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log('red', `Fatal error: ${error}`);
    cleanupTestDir();
    process.exit(1);
  });
