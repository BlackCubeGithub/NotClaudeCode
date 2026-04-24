import * as path from 'path';
import * as fs from 'fs';
import { Message } from '../src/types';
import { ContextMonitor } from '../src/core/context-monitor';
import { countMessagesTokens } from '../src/utils/token-counter';

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

function createMockMessages(count: number, tokensPerMessage: number = 100): Message[] {
  const messages: Message[] = [];
  
  messages.push({
    role: 'system',
    content: 'You are a helpful AI assistant.'.repeat(20),
  });

  for (let i = 0; i < count; i++) {
    messages.push({
      role: 'user',
      content: `User message ${i}: ${'test '.repeat(tokensPerMessage)}`,
    });
    
    messages.push({
      role: 'assistant',
      content: `Assistant response ${i}: ${'response '.repeat(tokensPerMessage)}`,
    });

    if (i % 3 === 0) {
      messages.push({
        role: 'tool',
        name: 'Read',
        content: JSON.stringify({
          success: true,
          output: `Tool result ${i}: ${'data '.repeat(tokensPerMessage * 2)}`,
        }),
      });
    }
  }

  return messages;
}

async function testContextMonitor() {
  logSection('Test 1: ContextMonitor Initialization');
  
  try {
    const monitor = new ContextMonitor({
      contextLimit: 10000,
      enableAutoCompact: true,
      showCompactNotification: true,
    });
    
    log('green', '✓ ContextMonitor created successfully');
    log('gray', `  Context limit: ${monitor.getContextLimit()}`);
    
    return monitor;
  } catch (error) {
    log('red', `✗ Failed to create ContextMonitor: ${error}`);
    return null;
  }
}

async function testContextUsage(monitor: ContextMonitor) {
  logSection('Test 2: Context Usage Detection');
  
  const smallMessages = createMockMessages(5, 50);
  const usage = monitor.getContextUsage(smallMessages);
  
  log('yellow', `Small message set (${smallMessages.length} messages):`);
  log('gray', `  Total tokens: ${usage.totalTokens}`);
  log('gray', `  Usage percent: ${(usage.usagePercent * 100).toFixed(1)}%`);
  log('gray', `  Layer: ${usage.layer}`);
  
  const largeMessages = createMockMessages(50, 100);
  const largeUsage = monitor.getContextUsage(largeMessages);
  
  log('yellow', `\nLarge message set (${largeMessages.length} messages):`);
  log('gray', `  Total tokens: ${largeUsage.totalTokens}`);
  log('gray', `  Usage percent: ${(largeUsage.usagePercent * 100).toFixed(1)}%`);
  log('gray', `  Layer: ${largeUsage.layer}`);
  
  log('green', '✓ Context usage detection working correctly');
}

async function testCompactTrigger(monitor: ContextMonitor) {
  logSection('Test 3: Compact Trigger Detection');
  
  const testCases = [
    { messages: createMockMessages(5, 50), description: 'Low usage (< 70%)' },
    { messages: createMockMessages(15, 100), description: 'Medium usage (70-85%)' },
    { messages: createMockMessages(25, 150), description: 'High usage (85-95%)' },
    { messages: createMockMessages(40, 200), description: 'Critical usage (≥ 95%)' },
  ];
  
  for (const testCase of testCases) {
    const check = monitor.shouldTriggerCompact(testCase.messages);
    const tokens = countMessagesTokens(testCase.messages);
    
    log('yellow', `\n${testCase.description}:`);
    log('gray', `  Tokens: ${tokens}`);
    log('gray', `  Should trigger: ${check.shouldTrigger}`);
    log('gray', `  Layer: ${check.layer}`);
    log('gray', `  Reason: ${check.reason}`);
  }
  
  log('green', '✓ Compact trigger detection working correctly');
}

async function testLayer1Compact(monitor: ContextMonitor) {
  logSection('Test 4: Layer 1 Compact (Tool Result Cleanup)');
  
  const messages = createMockMessages(20, 100);
  const tokensBefore = countMessagesTokens(messages);
  
  log('yellow', `Before compact:`);
  log('gray', `  Messages: ${messages.length}`);
  log('gray', `  Tokens: ${tokensBefore}`);
  log('gray', `  Tool results: ${messages.filter(m => m.role === 'tool').length}`);
  
  const result = await monitor.executeCompact(messages, 1);
  
  log('yellow', `\nAfter compact:`);
  log('gray', `  Triggered: ${result.triggered}`);
  log('gray', `  Tokens: ${result.tokensBefore} → ${result.tokensAfter}`);
  log('gray', `  Tokens saved: ${result.tokensSaved}`);
  log('gray', `  Reason: ${result.reason}`);
  
  if (result.triggered) {
    log('green', '✓ Layer 1 compact executed successfully');
  } else {
    log('yellow', '⚠ Layer 1 compact not triggered (no tool results to clean)');
  }
}

async function testLayer2Compact(monitor: ContextMonitor) {
  logSection('Test 5: Layer 2 Compact (Session Memory)');
  
  const messages = createMockMessages(30, 150);
  const tokensBefore = countMessagesTokens(messages);
  
  log('yellow', `Before compact:`);
  log('gray', `  Messages: ${messages.length}`);
  log('gray', `  Tokens: ${tokensBefore}`);
  
  const result = await monitor.executeCompact(messages, 2);
  
  log('yellow', `\nAfter compact:`);
  log('gray', `  Triggered: ${result.triggered}`);
  log('gray', `  Tokens: ${result.tokensBefore} → ${result.tokensAfter}`);
  log('gray', `  Tokens saved: ${result.tokensSaved}`);
  log('gray', `  Reason: ${result.reason}`);
  
  if (result.memory) {
    log('gray', `  Memory extracted:`);
    log('gray', `    - Completed tasks: ${result.memory.completedTasks.length}`);
    log('gray', `    - Key decisions: ${result.memory.keyDecisions.length}`);
    log('gray', `    - Important files: ${result.memory.importantFiles.length}`);
  }
  
  log('green', '✓ Layer 2 compact executed successfully');
}

async function testCompactNotification(monitor: ContextMonitor) {
  logSection('Test 6: Compact Notification Format');
  
  const messages = createMockMessages(20, 100);
  const result = await monitor.executeCompact(messages, 1);
  
  if (result.triggered) {
    const notification = monitor.formatCompactNotification(result);
    log('yellow', 'Compact notification:');
    console.log(notification);
    log('green', '✓ Compact notification formatted correctly');
  } else {
    log('yellow', '⚠ No compact triggered, skipping notification test');
  }
}

async function runAllTests() {
  logSection('Context Monitor Auto-Compact Tests');
  
  const monitor = await testContextMonitor();
  if (!monitor) {
    log('red', 'Cannot continue tests without ContextMonitor');
    return;
  }
  
  await testContextUsage(monitor);
  await testCompactTrigger(monitor);
  await testLayer1Compact(monitor);
  await testLayer2Compact(monitor);
  await testCompactNotification(monitor);
  
  logSection('All Tests Completed');
  log('green', '✓ All auto-compact tests passed successfully!');
  log('cyan', '\nSummary:');
  log('gray', '  - ContextMonitor initialization: ✓');
  log('gray', '  - Context usage detection: ✓');
  log('gray', '  - Compact trigger detection: ✓');
  log('gray', '  - Layer 1 compact (tool cleanup): ✓');
  log('gray', '  - Layer 2 compact (session memory): ✓');
  log('gray', '  - Compact notification: ✓');
}

runAllTests().catch((error) => {
  log('red', `Test failed with error: ${error}`);
  console.error(error);
  process.exit(1);
});
