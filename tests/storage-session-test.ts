import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Storage } from '../src/core/storage';
import { SessionManager } from '../src/core/session-manager';
import { Message, DEFAULT_SESSION_MEMORY } from '../src/types';

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

let testStorageDir: string;

function setupTestStorage(): void {
  testStorageDir = path.join(os.tmpdir(), `notclaudecode-storage-test-${Date.now()}`);
  fs.mkdirSync(testStorageDir, { recursive: true });
}

function cleanupTestStorage(): void {
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
}

async function testStorageInitialization() {
  logSection('Test 1: Storage Initialization');

  let passed = 0;
  let total = 0;

  total++;
  try {
    const storage = new Storage(testStorageDir);
    if (fs.existsSync(testStorageDir)) {
      log('green', '  ✓ Storage directory created');
      passed++;
    } else {
      log('red', '  ✗ Storage directory not created');
    }
  } catch (error) {
    log('red', `  ✗ Storage initialization threw: ${error}`);
  }

  total++;
  try {
    const storage = new Storage(testStorageDir);
    const indexPath = path.join(testStorageDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      log('green', '  ✓ Index file created');
      passed++;
    } else {
      log('red', '  ✗ Index file not created');
    }
  } catch (error) {
    log('red', `  ✗ Index creation threw: ${error}`);
  }

  total++;
  try {
    const storage = new Storage(testStorageDir);
    const sessionsPath = path.join(testStorageDir, 'sessions');
    if (fs.existsSync(sessionsPath)) {
      log('green', '  ✓ Sessions directory created');
      passed++;
    } else {
      log('red', '  ✗ Sessions directory not created');
    }
  } catch (error) {
    log('red', `  ✗ Sessions directory creation threw: ${error}`);
  }

  total++;
  try {
    const storage = new Storage(testStorageDir);
    const storagePath = storage.getStoragePath();
    if (storagePath === testStorageDir) {
      log('green', `  ✓ Storage path correct: ${storagePath}`);
      passed++;
    } else {
      log('red', `  ✗ Storage path incorrect: ${storagePath}`);
    }
  } catch (error) {
    log('red', `  ✗ Get storage path threw: ${error}`);
  }

  log('yellow', `\n  Storage Initialization: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testStorageSessionOperations() {
  logSection('Test 2: Storage Session Operations');

  const storage = new Storage(testStorageDir);

  let passed = 0;
  let total = 0;

  let sessionId: string;

  total++;
  try {
    const metadata = storage.createSession('test-provider', 'test-model', '/test/dir', 'Test Session');
    sessionId = metadata.id;

    if (metadata.id && metadata.provider === 'test-provider' && metadata.model === 'test-model') {
      log('green', `  ✓ Session created: ${metadata.id}`);
      passed++;
    } else {
      log('red', '  ✗ Session creation failed');
    }
  } catch (error) {
    log('red', `  ✗ Session creation threw: ${error}`);
  }

  total++;
  try {
    const exists = storage.sessionExists(sessionId!);
    if (exists) {
      log('green', '  ✓ Session exists check');
      passed++;
    } else {
      log('red', '  ✗ Session exists check failed');
    }
  } catch (error) {
    log('red', `  ✗ Session exists check threw: ${error}`);
  }

  total++;
  try {
    const metadata = storage.loadMetadata(sessionId!);
    if (metadata && metadata.title === 'Test Session') {
      log('green', '  ✓ Load session metadata');
      passed++;
    } else {
      log('red', '  ✗ Load session metadata failed');
    }
  } catch (error) {
    log('red', `  ✗ Load metadata threw: ${error}`);
  }

  total++;
  try {
    const messages: Message[] = [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'User message' },
      { role: 'assistant', content: 'Assistant response' },
    ];
    storage.saveMessages(sessionId!, messages);

    const loadedMessages = storage.loadMessages(sessionId!);
    if (loadedMessages.length === 3 && loadedMessages[1].content === 'User message') {
      log('green', `  ✓ Save and load messages (${loadedMessages.length} messages)`);
      passed++;
    } else {
      log('red', `  ✗ Save/load messages failed - got ${loadedMessages.length} messages`);
    }
  } catch (error) {
    log('red', `  ✗ Save/load messages threw: ${error}`);
  }

  total++;
  try {
    const newMessage: Message = { role: 'user', content: 'Another user message' };
    storage.appendMessage(sessionId!, newMessage);

    const loadedMessages = storage.loadMessages(sessionId!);
    if (loadedMessages.length === 4) {
      log('green', '  ✓ Append message');
      passed++;
    } else {
      log('red', `  ✗ Append message failed - got ${loadedMessages.length} messages`);
    }
  } catch (error) {
    log('red', `  ✗ Append message threw: ${error}`);
  }

  total++;
  try {
    const index = storage.loadIndex();
    const sessionEntry = index.sessions.find((s) => s.id === sessionId);
    if (sessionEntry && sessionEntry.title === 'Test Session') {
      log('green', '  ✓ Session added to index');
      passed++;
    } else {
      log('red', '  ✗ Session not in index');
    }
  } catch (error) {
    log('red', `  ✗ Load index threw: ${error}`);
  }

  total++;
  try {
    storage.deleteSession(sessionId!);
    const exists = storage.sessionExists(sessionId!);
    if (!exists) {
      log('green', '  ✓ Delete session');
      passed++;
    } else {
      log('red', '  ✗ Delete session failed');
    }
  } catch (error) {
    log('red', `  ✗ Delete session threw: ${error}`);
  }

  log('yellow', `\n  Storage Session Operations: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testStorageIndexOperations() {
  logSection('Test 3: Storage Index Operations');

  const storage = new Storage(testStorageDir);

  let passed = 0;
  let total = 0;

  total++;
  try {
    const index = storage.loadIndex();
    if (index && Array.isArray(index.sessions)) {
      log('green', '  ✓ Load index');
      passed++;
    } else {
      log('red', '  ✗ Load index failed');
    }
  } catch (error) {
    log('red', `  ✗ Load index threw: ${error}`);
  }

  total++;
  try {
    const metadata1 = storage.createSession('provider1', 'model1', '/dir1', 'Session 1');
    const metadata2 = storage.createSession('provider2', 'model2', '/dir2', 'Session 2');

    const index = storage.loadIndex();
    if (index.sessions.length >= 2) {
      log('green', `  ✓ Multiple sessions in index (${index.sessions.length})`);
      passed++;
    } else {
      log('red', '  ✗ Multiple sessions not in index');
    }

    storage.deleteSession(metadata1.id);
    storage.deleteSession(metadata2.id);
  } catch (error) {
    log('red', `  ✗ Multiple sessions threw: ${error}`);
  }

  total++;
  try {
    const metadata = storage.createSession('provider', 'model', '/dir', 'Test Session');
    storage.removeFromIndex(metadata.id);

    const index = storage.loadIndex();
    const exists = index.sessions.some((s) => s.id === metadata.id);
    if (!exists) {
      log('green', '  ✓ Remove from index');
      passed++;
    } else {
      log('red', '  ✗ Remove from index failed');
    }

    storage.deleteSession(metadata.id);
  } catch (error) {
    log('red', `  ✗ Remove from index threw: ${error}`);
  }

  log('yellow', `\n  Storage Index Operations: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testSessionManagerInitialization() {
  logSection('Test 4: SessionManager Initialization');

  const storage = new Storage(testStorageDir);

  let passed = 0;
  let total = 0;

  total++;
  try {
    const sessionManager = new SessionManager(storage);
    if (sessionManager.getCurrentSessionId() === null) {
      log('green', '  ✓ SessionManager initialized without active session');
      passed++;
    } else {
      log('red', '  ✗ SessionManager should have no active session');
    }
  } catch (error) {
    log('red', `  ✗ SessionManager initialization threw: ${error}`);
  }

  total++;
  try {
    const sessionManager = new SessionManager(storage);
    const sessionId = await sessionManager.createSession('test-provider', 'test-model', '/test/dir', 'Test Session');

    if (sessionId && sessionManager.getCurrentSessionId() === sessionId) {
      log('green', `  ✓ Session created: ${sessionId}`);
      passed++;
    } else {
      log('red', '  ✗ Session creation failed');
    }
  } catch (error) {
    log('red', `  ✗ Session creation threw: ${error}`);
  }

  log('yellow', `\n  SessionManager Initialization: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testSessionManagerMessageHandling() {
  logSection('Test 5: SessionManager Message Handling');

  const storage = new Storage(testStorageDir);
  const sessionManager = new SessionManager(storage);

  let passed = 0;
  let total = 0;

  await sessionManager.createSession('test-provider', 'test-model', '/test/dir');

  total++;
  try {
    const message: Message = { role: 'user', content: 'Hello!' };
    sessionManager.addMessage(message);

    const messages = sessionManager.getMessages();
    if (messages.length === 1 && messages[0].content === 'Hello!') {
      log('green', '  ✓ Add message');
      passed++;
    } else {
      log('red', `  ✗ Add message failed - got ${messages.length} messages`);
    }
  } catch (error) {
    log('red', `  ✗ Add message threw: ${error}`);
  }

  total++;
  try {
    const messages: Message[] = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'User' },
    ];
    sessionManager.setMessages(messages);

    const currentMessages = sessionManager.getMessages();
    if (currentMessages.length === 2) {
      log('green', '  ✓ Set messages');
      passed++;
    } else {
      log('red', `  ✗ Set messages failed - got ${currentMessages.length} messages`);
    }
  } catch (error) {
    log('red', `  ✗ Set messages threw: ${error}`);
  }

  total++;
  try {
    await sessionManager.saveSession();
    const metadata = sessionManager.getMetadata();

    if (metadata && metadata.messageCount === 2) {
      log('green', '  ✓ Save session');
      passed++;
    } else {
      log('red', '  ✗ Save session failed');
    }
  } catch (error) {
    log('red', `  ✗ Save session threw: ${error}`);
  }

  log('yellow', `\n  SessionManager Message Handling: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testSessionManagerSessionOperations() {
  logSection('Test 6: SessionManager Session Operations');

  const storage = new Storage(testStorageDir);
  const sessionManager = new SessionManager(storage);

  let passed = 0;
  let total = 0;

  let sessionId: string;

  total++;
  try {
    sessionId = await sessionManager.createSession('provider', 'model', '/dir', 'Test Session');
    const metadata = sessionManager.getMetadata();

    if (metadata && metadata.title === 'Test Session') {
      log('green', '  ✓ Get metadata');
      passed++;
    } else {
      log('red', '  ✗ Get metadata failed');
    }
  } catch (error) {
    log('red', `  ✗ Get metadata threw: ${error}`);
  }

  total++;
  try {
    const loaded = await sessionManager.loadSession(sessionId!);
    if (loaded) {
      log('green', '  ✓ Load existing session');
      passed++;
    } else {
      log('red', '  ✗ Load existing session failed');
    }
  } catch (error) {
    log('red', `  ✗ Load session threw: ${error}`);
  }

  total++;
  try {
    const loaded = await sessionManager.loadSession('nonexistent-session-id');
    if (!loaded) {
      log('green', '  ✓ Handle non-existent session');
      passed++;
    } else {
      log('red', '  ✗ Should not load non-existent session');
    }
  } catch (error) {
    log('green', '  ✓ Handle non-existent session (threw error)');
    passed++;
  }

  total++;
  try {
    const hasSession = sessionManager.hasActiveSession();
    if (hasSession) {
      log('green', '  ✓ Has active session');
      passed++;
    } else {
      log('red', '  ✗ Should have active session');
    }
  } catch (error) {
    log('red', `  ✗ Has active session threw: ${error}`);
  }

  log('yellow', `\n  SessionManager Session Operations: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testSessionManagerMemory() {
  logSection('Test 7: SessionManager Memory');

  const storage = new Storage(testStorageDir);
  const sessionManager = new SessionManager(storage);

  let passed = 0;
  let total = 0;

  await sessionManager.createSession('provider', 'model', '/dir');

  total++;
  try {
    const memory = sessionManager.getSessionMemory();
    if (memory) {
      log('green', '  ✓ Get session memory');
      passed++;
    } else {
      log('red', '  ✗ Get session memory failed');
    }
  } catch (error) {
    log('red', `  ✗ Get session memory threw: ${error}`);
  }

  total++;
  try {
    sessionManager.updateSessionMemory({
      projectOverview: 'Test project overview',
      completedTasks: ['Task 1'],
      keyDecisions: ['Decision 1'],
      importantFiles: ['file.ts'],
      currentState: 'Testing state',
    });

    const memory = sessionManager.getSessionMemory();
    if (memory.projectOverview === 'Test project overview') {
      log('green', '  ✓ Update session memory');
      passed++;
    } else {
      log('red', '  ✗ Update session memory failed');
    }
  } catch (error) {
    log('red', `  ✗ Update session memory threw: ${error}`);
  }

  log('yellow', `\n  SessionManager Memory: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Storage & SessionManager Test Suite');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Test directory: ${testStorageDir}`);

  setupTestStorage();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'Storage Initialization', passed: await testStorageInitialization() });
    results.push({ name: 'Storage Session Operations', passed: await testStorageSessionOperations() });
    results.push({ name: 'Storage Index Operations', passed: await testStorageIndexOperations() });
    results.push({ name: 'SessionManager Initialization', passed: await testSessionManagerInitialization() });
    results.push({ name: 'SessionManager Message Handling', passed: await testSessionManagerMessageHandling() });
    results.push({ name: 'SessionManager Session Operations', passed: await testSessionManagerSessionOperations() });
    results.push({ name: 'SessionManager Memory', passed: await testSessionManagerMemory() });
  } finally {
    cleanupTestStorage();
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
    cleanupTestStorage();
    process.exit(1);
  });
