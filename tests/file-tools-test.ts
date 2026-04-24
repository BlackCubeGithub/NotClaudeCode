import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReadTool } from '../src/tools/read';
import { WriteTool } from '../src/tools/write';
import { EditTool } from '../src/tools/edit';

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

let testDir: string;

function setupTestDir(): void {
  testDir = path.join(os.tmpdir(), `notclaudecode-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
}

function cleanupTestDir(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testReadTool() {
  logSection('Test 1: ReadTool');

  const readTool = new ReadTool();
  const testFile = path.join(testDir, 'test-read.txt');
  const testContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
  fs.writeFileSync(testFile, testContent);

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await readTool.execute({ file_path: testFile });
    if (result.success && result.output?.includes('Line 1')) {
      log('green', '  ✓ Read entire file');
      passed++;
    } else {
      log('red', `  ✗ Read entire file failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Read entire file threw: ${error}`);
  }

  total++;
  try {
    const result = await readTool.execute({ file_path: testFile, offset: 2 });
    if (result.success && result.output?.includes('Line 3') && !result.output?.includes('Line 1')) {
      log('green', '  ✓ Read with offset');
      passed++;
    } else {
      log('red', `  ✗ Read with offset failed`);
    }
  } catch (error) {
    log('red', `  ✗ Read with offset threw: ${error}`);
  }

  total++;
  try {
    const result = await readTool.execute({ file_path: testFile, offset: 0, limit: 2 });
    if (result.success && result.output?.includes('Line 1') && result.output?.includes('Line 2') && !result.output?.includes('Line 3')) {
      log('green', '  ✓ Read with limit');
      passed++;
    } else {
      log('red', `  ✗ Read with limit failed`);
    }
  } catch (error) {
    log('red', `  ✗ Read with limit threw: ${error}`);
  }

  total++;
  try {
    const result = await readTool.execute({ file_path: '/nonexistent/file.txt' });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle non-existent file');
      passed++;
    } else {
      log('red', `  ✗ Handle non-existent file failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle non-existent file threw: ${error}`);
  }

  total++;
  try {
    const result = await readTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  ReadTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testWriteTool() {
  logSection('Test 2: WriteTool');

  const writeTool = new WriteTool();
  const testFile = path.join(testDir, 'test-write.txt');

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await writeTool.execute({
      file_path: testFile,
      content: 'Hello, World!',
    });
    if (result.success && fs.existsSync(testFile)) {
      const content = fs.readFileSync(testFile, 'utf-8');
      if (content === 'Hello, World!') {
        log('green', '  ✓ Write new file');
        passed++;
      } else {
        log('red', `  ✗ Write new file - content mismatch`);
      }
    } else {
      log('red', `  ✗ Write new file failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Write new file threw: ${error}`);
  }

  total++;
  try {
    const result = await writeTool.execute({
      file_path: testFile,
      content: 'Overwritten content',
    });
    if (result.success) {
      const content = fs.readFileSync(testFile, 'utf-8');
      if (content === 'Overwritten content') {
        log('green', '  ✓ Overwrite existing file');
        passed++;
      } else {
        log('red', `  ✗ Overwrite existing file - content mismatch`);
      }
    } else {
      log('red', `  ✗ Overwrite existing file failed`);
    }
  } catch (error) {
    log('red', `  ✗ Overwrite existing file threw: ${error}`);
  }

  total++;
  try {
    const nestedFile = path.join(testDir, 'nested', 'dir', 'test.txt');
    const result = await writeTool.execute({
      file_path: nestedFile,
      content: 'Nested file content',
    });
    if (result.success && fs.existsSync(nestedFile)) {
      log('green', '  ✓ Create nested directories');
      passed++;
    } else {
      log('red', `  ✗ Create nested directories failed`);
    }
  } catch (error) {
    log('red', `  ✗ Create nested directories threw: ${error}`);
  }

  total++;
  try {
    const result = await writeTool.execute({ file_path: testFile });
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  WriteTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testEditTool() {
  logSection('Test 3: EditTool');

  const editTool = new EditTool();
  const testFile = path.join(testDir, 'test-edit.txt');

  let passed = 0;
  let total = 0;

  fs.writeFileSync(testFile, 'Hello World\nThis is a test\nGoodbye World');

  total++;
  try {
    const result = await editTool.execute({
      file_path: testFile,
      old_str: 'Hello World',
      new_str: 'Hi World',
    });
    if (result.success) {
      const content = fs.readFileSync(testFile, 'utf-8');
      if (content.includes('Hi World') && !content.includes('Hello World')) {
        log('green', '  ✓ Edit file content');
        passed++;
      } else {
        log('red', `  ✗ Edit file content - content mismatch`);
      }
    } else {
      log('red', `  ✗ Edit file content failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Edit file content threw: ${error}`);
  }

  total++;
  try {
    const result = await editTool.execute({
      file_path: testFile,
      old_str: 'NonExistentText',
      new_str: 'Replacement',
    });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle text not found');
      passed++;
    } else {
      log('red', `  ✗ Handle text not found failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle text not found threw: ${error}`);
  }

  total++;
  try {
    const result = await editTool.execute({
      file_path: '/nonexistent/file.txt',
      old_str: 'test',
      new_str: 'test2',
    });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle non-existent file');
      passed++;
    } else {
      log('red', `  ✗ Handle non-existent file failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle non-existent file threw: ${error}`);
  }

  total++;
  try {
    const result = await editTool.execute({ file_path: testFile });
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  EditTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 4: Tool Definitions');

  const readTool = new ReadTool();
  const writeTool = new WriteTool();
  const editTool = new EditTool();

  let passed = 0;
  let total = 4;

  if (readTool.definition.name === 'Read') {
    log('green', '  ✓ ReadTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ ReadTool name incorrect');
  }

  if (writeTool.definition.name === 'Write') {
    log('green', '  ✓ WriteTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ WriteTool name incorrect');
  }

  if (editTool.definition.name === 'Edit') {
    log('green', '  ✓ EditTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ EditTool name incorrect');
  }

  const allHaveRequiredParams = [readTool, writeTool, editTool].every(
    (tool) => tool.definition.parameters.required.length > 0
  );
  if (allHaveRequiredParams) {
    log('green', '  ✓ All tools have required parameters defined');
    passed++;
  } else {
    log('red', '  ✗ Some tools missing required parameters');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  File Tools Test Suite (Read, Write, Edit)');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Test directory: ${testDir}`);

  setupTestDir();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'ReadTool', passed: await testReadTool() });
    results.push({ name: 'WriteTool', passed: await testWriteTool() });
    results.push({ name: 'EditTool', passed: await testEditTool() });
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
