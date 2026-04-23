import * as path from 'path';
import * as fs from 'fs';
import { Message } from '../src/types';
import { 
  countMessagesTokens, 
  getToolResultCount,
} from '../src/utils/token-counter';
import {
  toolResultCleanup,
  shouldTriggerToolResultCleanup,
  getToolResultStats,
} from '../src/core/compact';
import {
  extractSessionMemory,
  layer2Compact,
  shouldTriggerLayer2Compact,
  layer3Compact,
  shouldTriggerLayer3Compact,
} from '../src/core/memory';
import { DeepSeekProvider } from '../src/ai/deepseek-provider';
import { OpenAIProvider } from '../src/ai/openai-provider';

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
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log('cyan', `  ${title}`);
  console.log('='.repeat(60));
}

function createRealisticToolResults(count: number, largeOutput: boolean = true): Message[] {
  const messages: Message[] = [];
  
  messages.push({
    role: 'system',
    content: 'You are NotClaudeCode, a powerful code assistant.',
  });
  
  messages.push({
    role: 'user',
    content: 'I need you to analyze my project and help me implement a new feature.',
  });
  
  messages.push({
    role: 'assistant',
    content: 'I will help you analyze your project. Let me start by exploring the codebase.',
  });
  
  for (let i = 0; i < count; i++) {
    const fileName = `src/module${i}/component${i}.ts`;
    
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: `call_read_${i}`,
        type: 'function',
        function: {
          name: 'Read',
          arguments: JSON.stringify({ file_path: fileName }),
        },
      }],
    });
    
    const fileContent = largeOutput 
      ? `// File: ${fileName}\n` + 
        `import { Component } from 'react';\n`.repeat(20) +
        `export class Component${i} extends Component {\n` +
        `  render() {\n`.repeat(10) +
        `    return <div>${'x'.repeat(500)}</div>;\n` +
        `  }\n`.repeat(10) +
        `}\n` +
        `// End of file ${fileName}\n`.repeat(10)
      : `// File: ${fileName}\nexport const x = ${i};\n`;
    
    messages.push({
      role: 'tool',
      tool_call_id: `call_read_${i}`,
      name: 'Read',
      content: JSON.stringify({
        success: true,
        output: fileContent,
      }),
    });
    
    messages.push({
      role: 'assistant',
      content: `I've read ${fileName}. This file contains a React component. Let me check another file.`,
    });
  }
  
  messages.push({
    role: 'user',
    content: 'Please continue analyzing and provide a summary.',
  });
  
  messages.push({
    role: 'assistant',
    content: 'Based on my analysis, I found several patterns in your codebase. Here are my recommendations...',
  });
  
  return messages;
}

function createRealisticConversation(turns: number): Message[] {
  const messages: Message[] = [];
  
  messages.push({
    role: 'system',
    content: 'You are NotClaudeCode, a powerful code assistant.',
  });
  
  const topics = [
    { file: 'src/auth/login.ts', issue: 'authentication flow', solution: 'implement JWT tokens' },
    { file: 'src/api/users.ts', issue: 'user management', solution: 'add CRUD operations' },
    { file: 'src/utils/helpers.ts', issue: 'utility functions', solution: 'refactor for reusability' },
    { file: 'src/components/Button.tsx', issue: 'button component', solution: 'add variant props' },
    { file: 'src/hooks/useAuth.ts', issue: 'auth hook', solution: 'add error handling' },
  ];
  
  for (let i = 0; i < turns; i++) {
    const topic = topics[i % topics.length];
    
    messages.push({
      role: 'user',
      content: `I'm working on ${topic.issue} in ${topic.file}. Can you help me ${topic.solution}? This is turn ${i + 1} of our conversation. I need detailed guidance on how to implement this properly.`,
    });
    
    messages.push({
      role: 'assistant',
      content: `Sure! Let me help you with ${topic.issue} in ${topic.file}. Here's my approach:\n\n1. First, we need to understand the current implementation\n2. Then, we'll ${topic.solution}\n3. Finally, we'll test the changes\n\nLet me read the file first to understand the context better.`,
    });
    
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: `call_${i}`,
        type: 'function',
        function: {
          name: 'Read',
          arguments: JSON.stringify({ file_path: topic.file }),
        },
      }],
    });
    
    messages.push({
      role: 'tool',
      tool_call_id: `call_${i}`,
      name: 'Read',
      content: JSON.stringify({
        success: true,
        output: `// Content of ${topic.file}\n` + 'export function example() { return true; }\n'.repeat(30),
      }),
    });
    
    messages.push({
      role: 'assistant',
      content: `I've analyzed ${topic.file}. Here's my implementation plan:\n\n\`\`\`typescript\n// Implementation for ${topic.solution}\nexport function implement${i}() {\n  // Add your logic here\n  return true;\n}\n\`\`\`\n\nThis should solve your ${topic.issue} problem. Let me know if you need any clarification.`,
    });
  }
  
  return messages;
}

async function testLayer1RealCompression() {
  logSection('Test 1: Layer 1 Real Compression');
  
  const contextLimit = 8000;
  const messages = createRealisticToolResults(20, true);
  const tokensBefore = countMessagesTokens(messages);
  const usageBefore = tokensBefore / contextLimit;
  
  log('yellow', `Created realistic scenario with ${messages.length} messages`);
  log('yellow', `Tokens: ${tokensBefore.toLocaleString()} (${(usageBefore * 100).toFixed(1)}% usage)`);
  log('yellow', `Tool results: ${getToolResultCount(messages)}`);
  
  if (usageBefore < 0.7) {
    log('red', `✗ Usage ${(usageBefore * 100).toFixed(1)}% is below 70% threshold, cannot test compression`);
    return false;
  }
  
  const shouldTrigger = shouldTriggerToolResultCleanup(messages, contextLimit, 0.7);
  log('magenta', `Should trigger: ${shouldTrigger}`);
  
  if (!shouldTrigger) {
    log('red', '✗ Layer 1 should trigger but returned false');
    return false;
  }
  
  const result = toolResultCleanup(messages, contextLimit, 0.7);
  
  log('green', `\nCompression Result:`);
  log('green', `  Triggered: ${result.triggered}`);
  log('green', `  Tokens: ${result.tokensBefore.toLocaleString()} → ${result.tokensAfter.toLocaleString()}`);
  log('green', `  Saved: ${(result.tokensBefore - result.tokensAfter).toLocaleString()} tokens`);
  log('green', `  Tool results cleaned: ${result.toolResultsCleaned}`);
  log('green', `  New usage: ${((result.tokensAfter / contextLimit) * 100).toFixed(1)}%`);
  
  if (!result.triggered) {
    log('red', `✗ Compression not triggered: ${result.reason}`);
    return false;
  }
  
  if (result.tokensAfter >= result.tokensBefore) {
    log('red', '✗ Tokens did not decrease after compression');
    return false;
  }
  
  if (result.toolResultsCleaned === 0) {
    log('red', '✗ No tool results were cleaned');
    return false;
  }
  
  log('green', '\n✓ Layer 1 compression working correctly');
  return true;
}

async function testLayer2RealCompression() {
  logSection('Test 2: Layer 2 Real Compression');
  
  const contextLimit = 6000;
  const messages = createRealisticConversation(15);
  const tokensBefore = countMessagesTokens(messages);
  const usageBefore = tokensBefore / contextLimit;
  
  log('yellow', `Created realistic conversation with ${messages.length} messages`);
  log('yellow', `Tokens: ${tokensBefore.toLocaleString()} (${(usageBefore * 100).toFixed(1)}% usage)`);
  
  if (usageBefore < 0.8) {
    log('yellow', `Warning: Usage ${(usageBefore * 100).toFixed(1)}% is below 80% threshold`);
  }
  
  const result = layer2Compact(messages, contextLimit);
  const tokensAfter = countMessagesTokens(result.messages);
  
  log('green', `\nCompression Result:`);
  log('green', `  Messages: ${messages.length} → ${result.messages.length}`);
  log('green', `  Tokens: ${tokensBefore.toLocaleString()} → ${tokensAfter.toLocaleString()}`);
  log('green', `  Saved: ${result.tokensSaved.toLocaleString()} tokens`);
  log('green', `  Summarized: ${result.messagesSummarized} messages`);
  
  log('magenta', `\nExtracted Memory:`);
  log('gray', `  Project Overview: ${result.memory.projectOverview.substring(0, 80)}...`);
  log('gray', `  Completed Tasks: ${result.memory.completedTasks.length}`);
  log('gray', `  Key Decisions: ${result.memory.keyDecisions.length}`);
  log('gray', `  Important Files: ${result.memory.importantFiles.length}`);
  log('gray', `  Current State: ${result.memory.currentState.substring(0, 80)}...`);
  
  if (result.tokensSaved <= 0) {
    log('red', '✗ No tokens saved');
    return false;
  }
  
  if (result.messages.length >= messages.length) {
    log('red', '✗ Message count did not decrease');
    return false;
  }
  
  log('green', '\n✓ Layer 2 compression working correctly');
  return true;
}

async function testLayer3RealCompression() {
  logSection('Test 3: Layer 3 Real Compression (Requires API Key)');
  
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    log('yellow', '⚠ No API key found. Set DEEPSEEK_API_KEY or OPENAI_API_KEY to run this test.');
    log('gray', 'Skipping Layer 3 real compression test.');
    return true;
  }
  
  const provider = process.env.DEEPSEEK_API_KEY 
    ? new DeepSeekProvider(process.env.DEEPSEEK_API_KEY!)
    : new OpenAIProvider(process.env.OPENAI_API_KEY!);
  
  const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';
  
  log('yellow', `Using provider: ${process.env.DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
  log('yellow', `Model: ${model}`);
  
  const contextLimit = 4000;
  const messages = createRealisticConversation(10);
  const tokensBefore = countMessagesTokens(messages);
  const usageBefore = tokensBefore / contextLimit;
  
  log('yellow', `\nCreated conversation with ${messages.length} messages`);
  log('yellow', `Tokens: ${tokensBefore.toLocaleString()} (${(usageBefore * 100).toFixed(1)}% usage)`);
  
  log('gray', '\nCalling AI to generate summary (this may take a moment)...');
  
  try {
    const result = await layer3Compact(messages, provider, contextLimit, 5);
    const tokensAfter = countMessagesTokens(result.messages);
    
    log('green', `\nCompression Result:`);
    log('green', `  Messages: ${messages.length} → ${result.messages.length}`);
    log('green', `  Tokens: ${tokensBefore.toLocaleString()} → ${tokensAfter.toLocaleString()}`);
    log('green', `  Saved: ${result.tokensSaved.toLocaleString()} tokens`);
    log('green', `  Summarized: ${result.messagesSummarized} messages`);
    
    if (result.summary) {
      log('magenta', `\nGenerated Summary:`);
      log('gray', result.summary.substring(0, 500) + (result.summary.length > 500 ? '...' : ''));
    }
    
    if (result.tokensSaved <= 0) {
      log('red', '✗ No tokens saved');
      return false;
    }
    
    log('green', '\n✓ Layer 3 compression working correctly');
    return true;
  } catch (error) {
    log('red', `✗ Layer 3 compression failed: ${error}`);
    return false;
  }
}

async function testFullPipelineRealistic() {
  logSection('Test 4: Full Pipeline Realistic Scenario');
  
  const contextLimit = 5000;
  let messages = createRealisticToolResults(15, true);
  messages = [...messages, ...createRealisticConversation(8)];
  
  let tokens = countMessagesTokens(messages);
  let usage = tokens / contextLimit;
  
  log('yellow', `Initial State:`);
  log('yellow', `  Messages: ${messages.length}`);
  log('yellow', `  Tokens: ${tokens.toLocaleString()} (${(usage * 100).toFixed(1)}% usage)`);
  log('yellow', `  Tool Results: ${getToolResultCount(messages)}`);
  
  const compressionLog: { layer: string; before: number; after: number; saved: number }[] = [];
  
  if (usage >= 0.95) {
    log('magenta', '\n[Layer 3] Attempting AI summary compression...');
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      const provider = process.env.DEEPSEEK_API_KEY 
        ? new DeepSeekProvider(process.env.DEEPSEEK_API_KEY!)
        : new OpenAIProvider(process.env.OPENAI_API_KEY!);
      
      try {
        const result = await layer3Compact(messages, provider, contextLimit, 5);
        compressionLog.push({
          layer: 'Layer 3',
          before: tokens,
          after: countMessagesTokens(result.messages),
          saved: result.tokensSaved,
        });
        messages = result.messages;
        tokens = countMessagesTokens(messages);
        usage = tokens / contextLimit;
        log('green', `  → ${tokens.toLocaleString()} tokens (${(usage * 100).toFixed(1)}%)`);
      } catch (e) {
        log('yellow', `  Skipped: ${e}`);
      }
    } else {
      log('yellow', '  Skipped: No API key available');
    }
  }
  
  if (usage >= 0.85) {
    log('magenta', '\n[Layer 2] Session memory compression...');
    const result = layer2Compact(messages, contextLimit);
    compressionLog.push({
      layer: 'Layer 2',
      before: tokens,
      after: countMessagesTokens(result.messages),
      saved: result.tokensSaved,
    });
    messages = result.messages;
    tokens = countMessagesTokens(messages);
    usage = tokens / contextLimit;
    log('green', `  → ${tokens.toLocaleString()} tokens (${(usage * 100).toFixed(1)}%)`);
  }
  
  if (usage >= 0.7 && shouldTriggerToolResultCleanup(messages, contextLimit, 0.7)) {
    log('magenta', '\n[Layer 1] Tool result cleanup...');
    const result = toolResultCleanup(messages, contextLimit, 0.7);
    
    if (result.triggered) {
      compressionLog.push({
        layer: 'Layer 1',
        before: tokens,
        after: result.tokensAfter,
        saved: tokens - result.tokensAfter,
      });
      messages = result.messages;
      tokens = countMessagesTokens(messages);
      usage = tokens / contextLimit;
      log('green', `  → ${tokens.toLocaleString()} tokens (${(usage * 100).toFixed(1)}%)`);
    }
  }
  
  log('cyan', '\nFinal State:');
  log('green', `  Messages: ${messages.length}`);
  log('green', `  Tokens: ${tokens.toLocaleString()} (${(usage * 100).toFixed(1)}% usage)`);
  
  if (compressionLog.length > 0) {
    log('cyan', '\nCompression Log:');
    for (const entry of compressionLog) {
      log('gray', `  ${entry.layer}: ${entry.before.toLocaleString()} → ${entry.after.toLocaleString()} (saved ${entry.saved.toLocaleString()})`);
    }
    log('green', '\n✓ Full pipeline executed successfully');
    return true;
  } else {
    log('yellow', 'No compression layers triggered');
    return true;
  }
}

async function testMemoryExtractionQuality() {
  logSection('Test 5: Memory Extraction Quality');
  
  const messages: Message[] = [
    { role: 'system', content: 'You are NotClaudeCode.' },
    { role: 'user', content: 'I want to build a REST API for my e-commerce project located at D:/projects/ecommerce-api' },
    { role: 'assistant', content: 'I will help you build the REST API. Let me explore your project structure first.' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'LS', arguments: '{"path":"D:/projects/ecommerce-api/src"}' } }] },
    { role: 'tool', tool_call_id: 'c1', name: 'LS', content: '{"success":true,"output":"src/controllers\\nsrc/models\\nsrc/routes"}' },
    { role: 'assistant', content: 'I see you have a typical MVC structure. I recommend using Express.js with TypeScript.' },
    { role: 'user', content: 'Good idea! I decided to use PostgreSQL as the database instead of MongoDB.' },
    { role: 'assistant', content: 'Great decision! PostgreSQL is excellent for e-commerce. I have implemented the user authentication module.' },
    { role: 'user', content: 'There is a bug in the login function - it returns 500 error.' },
    { role: 'assistant', content: 'I found the issue. The problem was a missing await in the async function. I have fixed the error in D:/projects/ecommerce-api/src/controllers/auth.ts.' },
    { role: 'user', content: 'Thanks! Now I need to add product management features.' },
    { role: 'assistant', content: 'I have completed the product CRUD operations. The implementation is in D:/projects/ecommerce-api/src/controllers/products.ts.' },
  ];
  
  log('yellow', 'Extracting memory from realistic conversation...');
  
  const memory = extractSessionMemory(messages);
  
  log('green', '\nExtracted Memory:');
  log('white', `\nProject Overview:`);
  log('gray', `  ${memory.projectOverview}`);
  
  log('white', `\nCompleted Tasks (${memory.completedTasks.length}):`);
  memory.completedTasks.forEach((task, i) => {
    log('gray', `  ${i + 1}. ${task.substring(0, 100)}...`);
  });
  
  log('white', `\nKey Decisions (${memory.keyDecisions.length}):`);
  memory.keyDecisions.forEach((decision, i) => {
    log('gray', `  ${i + 1}. ${decision.substring(0, 100)}...`);
  });
  
  log('white', `\nImportant Files (${memory.importantFiles.length}):`);
  memory.importantFiles.forEach((file) => {
    log('gray', `  - ${file}`);
  });
  
  log('white', `\nProblems & Solutions (${memory.problemsAndSolutions.length}):`);
  memory.problemsAndSolutions.forEach((ps, i) => {
    log('gray', `  ${i + 1}. ${ps.substring(0, 100)}...`);
  });
  
  log('white', `\nCurrent State:`);
  log('gray', `  ${memory.currentState}`);
  
  const hasFiles = memory.importantFiles.length > 0;
  const hasDecisions = memory.keyDecisions.length > 0;
  const hasProblems = memory.problemsAndSolutions.length > 0;
  
  if (hasFiles && hasDecisions) {
    log('green', '\n✓ Memory extraction quality is good');
    return true;
  } else {
    log('yellow', '\n⚠ Memory extraction may need improvement');
    return true;
  }
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Real-World Memory System Test Suite');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  
  const hasApiKey = !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY);
  log('gray', `  API Key available: ${hasApiKey ? 'Yes' : 'No'}`);

  const tests = [
    { name: 'Layer 1 Real Compression', fn: testLayer1RealCompression },
    { name: 'Layer 2 Real Compression', fn: testLayer2RealCompression },
    { name: 'Layer 3 Real Compression', fn: testLayer3RealCompression },
    { name: 'Full Pipeline', fn: testFullPipelineRealistic },
    { name: 'Memory Extraction Quality', fn: testMemoryExtractionQuality },
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      log('red', `Test "${test.name}" threw an error: ${error}`);
      results.push({ name: test.name, passed: false });
    }
  }

  logSection('Test Results Summary');
  
  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(color, `  ${icon} ${result.name}`);
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log('\n' + '-'.repeat(60));
  if (passed === total) {
    log('green', `  All ${total} tests passed! 🎉`);
  } else {
    log('yellow', `  ${passed}/${total} tests passed`);
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
    process.exit(1);
  });
