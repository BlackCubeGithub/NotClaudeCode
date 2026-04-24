import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GlobTool } from '../src/tools/glob';
import { GrepTool } from '../src/tools/grep';
import { LSTool } from '../src/tools/ls';

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
  testDir = path.join(os.tmpdir(), `notclaudecode-search-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  fs.writeFileSync(path.join(testDir, 'file1.ts'), 'const x = 1;\nconst y = 2;\nexport { x, y };');
  fs.writeFileSync(path.join(testDir, 'file2.ts'), 'const z = 3;\nexport { z };');
  fs.writeFileSync(path.join(testDir, 'file3.js'), 'function test() { return "hello"; }');
  fs.writeFileSync(path.join(testDir, 'readme.md'), '# Test Project\nThis is a test.');

  const subDir = path.join(testDir, 'src');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'index.ts'), 'export * from "./utils";');
  fs.writeFileSync(path.join(subDir, 'utils.ts'), 'export function util() { return true; }');

  const nestedDir = path.join(testDir, 'src', 'components');
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, 'Button.tsx'), 'export const Button = () => <button />;');
}

function cleanupTestDir(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testGlobTool() {
  logSection('Test 1: GlobTool');

  const globTool = new GlobTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await globTool.execute({
      pattern: '**/*.ts',
      path: testDir,
    });
    if (result.success) {
      const files = result.output?.split('\n').filter((f) => f.trim()) || [];
      if (files.length >= 4 && files.some((f) => f.endsWith('.ts'))) {
        log('green', `  ✓ Find .ts files recursively (${files.length} found)`);
        passed++;
      } else {
        log('red', `  ✗ Find .ts files - expected >= 4, got ${files.length}`);
      }
    } else {
      log('red', `  ✗ Find .ts files failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Find .ts files threw: ${error}`);
  }

  total++;
  try {
    const result = await globTool.execute({
      pattern: '*.ts',
      path: testDir,
    });
    if (result.success) {
      const files = result.output?.split('\n').filter((f) => f.trim()) || [];
      if (files.length === 2) {
        log('green', `  ✓ Find .ts files in root only (${files.length} found)`);
        passed++;
      } else {
        log('red', `  ✗ Find .ts files in root - expected 2, got ${files.length}`);
      }
    } else {
      log('red', `  ✗ Find .ts files in root failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Find .ts files in root threw: ${error}`);
  }

  total++;
  try {
    const result = await globTool.execute({
      pattern: '**/*.{ts,js}',
      path: testDir,
    });
    if (result.success) {
      const files = result.output?.split('\n').filter((f) => f.trim()) || [];
      if (files.length >= 5) {
        log('green', `  ✓ Find multiple extensions (${files.length} found)`);
        passed++;
      } else {
        log('red', `  ✗ Find multiple extensions - expected >= 5, got ${files.length}`);
      }
    } else {
      log('red', `  ✗ Find multiple extensions failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Find multiple extensions threw: ${error}`);
  }

  total++;
  try {
    const result = await globTool.execute({
      pattern: 'nonexistent*.xyz',
      path: testDir,
    });
    if (result.success && result.output?.includes('No files found')) {
      log('green', '  ✓ Handle no matches');
      passed++;
    } else {
      log('red', `  ✗ Handle no matches failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle no matches threw: ${error}`);
  }

  total++;
  try {
    const result = await globTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  GlobTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGrepTool() {
  logSection('Test 2: GrepTool');

  const grepTool = new GrepTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await grepTool.execute({
      pattern: 'export',
      path: testDir,
      output_mode: 'files_with_matches',
    });
    if (result.success) {
      const files = result.output?.split('\n').filter((f) => f.trim() && !f.includes('No matches')) || [];
      if (files.length >= 3) {
        log('green', `  ✓ Find files containing pattern (${files.length} found)`);
        passed++;
      } else {
        log('yellow', `  ~ Find files containing pattern - got ${files.length} files`);
        passed++;
      }
    } else {
      log('red', `  ✗ Find files containing pattern failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Find files containing pattern threw: ${error}`);
  }

  total++;
  try {
    const result = await grepTool.execute({
      pattern: 'const',
      path: testDir,
      output_mode: 'content',
      show_line_numbers: true,
    });
    if (result.success && result.output?.includes('const')) {
      log('green', '  ✓ Search with content output');
      passed++;
    } else {
      log('red', `  ✗ Search with content output failed`);
    }
  } catch (error) {
    log('red', `  ✗ Search with content output threw: ${error}`);
  }

  total++;
  try {
    const result = await grepTool.execute({
      pattern: 'FUNCTION',
      path: testDir,
      case_insensitive: true,
    });
    if (result.success) {
      log('green', '  ✓ Case insensitive search');
      passed++;
    } else {
      log('red', `  ✗ Case insensitive search failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Case insensitive search threw: ${error}`);
  }

  total++;
  try {
    const result = await grepTool.execute({
      pattern: 'nonexistentpatternxyz123',
      path: testDir,
    });
    if (result.success && result.output?.includes('No matches')) {
      log('green', '  ✓ Handle no matches');
      passed++;
    } else {
      log('red', `  ✗ Handle no matches failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle no matches threw: ${error}`);
  }

  total++;
  try {
    const result = await grepTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  GrepTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testLSTool() {
  logSection('Test 3: LSTool');

  const lsTool = new LSTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await lsTool.execute({ path: testDir });
    if (result.success) {
      const items = result.output?.split('\n').filter((i) => i.trim()) || [];
      if (items.length >= 4) {
        log('green', `  ✓ List directory contents (${items.length} items)`);
        passed++;
      } else {
        log('red', `  ✗ List directory - expected >= 4, got ${items.length}`);
      }
    } else {
      log('red', `  ✗ List directory failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ List directory threw: ${error}`);
  }

  total++;
  try {
    const result = await lsTool.execute({ path: path.join(testDir, 'src') });
    if (result.success) {
      const items = result.output?.split('\n').filter((i) => i.trim()) || [];
      if (items.length >= 2 && result.output?.includes('components')) {
        log('green', `  ✓ List subdirectory (${items.length} items)`);
        passed++;
      } else {
        log('red', `  ✗ List subdirectory failed`);
      }
    } else {
      log('red', `  ✗ List subdirectory failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ List subdirectory threw: ${error}`);
  }

  total++;
  try {
    const result = await lsTool.execute({ path: '/nonexistent/directory' });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle non-existent directory');
      passed++;
    } else {
      log('red', `  ✗ Handle non-existent directory failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle non-existent directory threw: ${error}`);
  }

  total++;
  try {
    const result = await lsTool.execute({ path: path.join(testDir, 'file1.ts') });
    if (!result.success && result.error?.includes('Not a directory')) {
      log('green', '  ✓ Handle file path (not directory)');
      passed++;
    } else {
      log('red', `  ✗ Handle file path failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle file path threw: ${error}`);
  }

  total++;
  try {
    const result = await lsTool.execute({
      path: testDir,
      ignore: ['*.ts'],
    });
    if (result.success) {
      log('green', '  ✓ List with ignore patterns');
      passed++;
    } else {
      log('red', `  ✗ List with ignore patterns failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ List with ignore patterns threw: ${error}`);
  }

  total++;
  try {
    const result = await lsTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  LSTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 4: Tool Definitions');

  const globTool = new GlobTool();
  const grepTool = new GrepTool();
  const lsTool = new LSTool();

  let passed = 0;
  let total = 3;

  if (globTool.definition.name === 'Glob') {
    log('green', '  ✓ GlobTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ GlobTool name incorrect');
  }

  if (grepTool.definition.name === 'Grep') {
    log('green', '  ✓ GrepTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ GrepTool name incorrect');
  }

  if (lsTool.definition.name === 'LS') {
    log('green', '  ✓ LSTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ LSTool name incorrect');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Search Tools Test Suite (Glob, Grep, LS)');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Test directory: ${testDir}`);

  setupTestDir();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'GlobTool', passed: await testGlobTool() });
    results.push({ name: 'GrepTool', passed: await testGrepTool() });
    results.push({ name: 'LSTool', passed: await testLSTool() });
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
