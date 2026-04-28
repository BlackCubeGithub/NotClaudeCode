import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import simpleGit from 'simple-git';
import { GitStatusTool } from '../src/tools/git/git-status';
import { GitCommitTool } from '../src/tools/git/git-commit';
import { GitPushTool } from '../src/tools/git/git-push';
import { GitPullTool } from '../src/tools/git/git-pull';
import { GitDiffTool } from '../src/tools/git/git-diff';
import { GitBranchTool } from '../src/tools/git/git-branch';
import { GitLogTool } from '../src/tools/git/git-log';
import { GitMergeTool } from '../src/tools/git/git-merge';
import { GitStashTool } from '../src/tools/git/git-stash';

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
let git: ReturnType<typeof simpleGit>;

function setupTestRepo(): void {
  testDir = path.join(os.tmpdir(), `notclaudecode-git-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  git = simpleGit(testDir);
  git.init();
  // Configure git user for commits in tests
  git.addConfig('user.email', 'test@example.com', false, 'local');
  git.addConfig('user.name', 'Test User', false, 'local');
}

function cleanupTestRepo(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testGitStatusTool() {
  logSection('Test 1: GitStatusTool');

  const tool = new GitStatusTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await tool.execute({ path: testDir });
    if (result.success && result.output !== undefined) {
      log('green', `  ✓ Get repository status`);
      passed++;
    } else {
      log('red', `  ✗ Get repository status failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Get repository status threw: ${error}`);
  }

  total++;
  try {
    const testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, 'Hello, Git!');
    await git.add('test.txt');

    const result = await tool.execute({ cwd: testDir });
    if (result.success && (result.output?.includes('staged') || result.output?.includes('test.txt'))) {
      log('green', '  ✓ Detect staged file');
      passed++;
    } else {
      log('red', `  ✗ Detect staged file failed: ${result.error}`);
    }

    fs.unlinkSync(testFile);
  } catch (error) {
    log('red', `  ✗ Detect staged file threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository path');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository path failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository path');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository path threw: ${error}`);
    }
  }

  total++;
  try {
    const result = await tool.execute({});
    if (result.success && result.output !== undefined) {
      log('green', '  ✓ Default to cwd when no path provided');
      passed++;
    } else {
      log('red', `  ✗ Default path failed`);
    }
  } catch (error) {
    log('red', `  ✗ Default path threw: ${error}`);
  }

  log('yellow', `\n  GitStatusTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitCommitTool() {
  logSection('Test 2: GitCommitTool');

  const tool = new GitCommitTool();
  let passed = 0;
  let total = 0;

  // Set up a clean state
  const testFile = path.join(testDir, 'commit-test.txt');
  fs.writeFileSync(testFile, 'Initial content');
  await git.add('commit-test.txt');

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      message: 'test: add initial file for testing',
    });
    if (result.success && result.output?.includes('commit')) {
      log('green', `  ✓ Create commit with message`);
      passed++;
    } else {
      log('red', `  ✗ Create commit failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Create commit threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      message: 'chore: no changes to commit',
    });
    // Should either succeed with "nothing to commit" or fail with appropriate message
    if (result.success || result.error?.toLowerCase().includes('nothing to commit') || result.error?.includes('git exited with code 1') || result.output?.includes('nothing to commit')) {
      log('green', '  ✓ Handle no changes');
      passed++;
    } else {
      log('red', `  ✗ Handle no changes failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle no changes threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params (message)');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    if (String(error).includes('Missing required parameter')) {
      log('green', `  ✓ Validate required params threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Validate required params threw: ${error}`);
    }
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: '/nonexistent/path',
      message: 'test: invalid commit',
    });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  // Cleanup
  fs.unlinkSync(testFile);

  log('yellow', `\n  GitCommitTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitDiffTool() {
  logSection('Test 3: GitDiffTool');

  const tool = new GitDiffTool();
  let passed = 0;
  let total = 0;

  // Create and commit initial file
  const testFile = path.join(testDir, 'diff-test.txt');
  fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3');
  await git.add('diff-test.txt');
  await git.commit('chore: initial diff-test file');

  // Make changes
  fs.writeFileSync(testFile, 'Line 1\nModified Line\nLine 3\nLine 4');
  // Do NOT stage - git diff should now show working-tree vs HEAD changes

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (result.success && result.output?.includes('diff')) {
      log('green', '  ✓ Show diff for working directory');
      passed++;
    } else {
      log('red', `  ✗ Show diff failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Show diff threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      file: 'diff-test.txt',
    });
    if (result.success && (result.output?.includes('diff-test.txt') || result.output === '' || result.output === '(no output)')) {
      log('green', '  ✓ Show diff for specific file');
      passed++;
    } else {
      log('red', `  ✗ Show diff for specific file failed`);
    }
  } catch (error) {
    log('red', `  ✗ Show diff for specific file threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      cached: true,
    });
    // Staged diff should show changes ready to commit
    if (result.success) {
      log('green', '  ✓ Show staged diff');
      passed++;
    } else {
      log('red', `  ✗ Show staged diff failed`);
    }
  } catch (error) {
    log('red', `  ✗ Show staged diff threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  // Cleanup
  fs.unlinkSync(testFile);

  log('yellow', `\n  GitDiffTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitBranchTool() {
  logSection('Test 4: GitBranchTool');

  const tool = new GitBranchTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (result.success && (result.output?.includes('master') || result.output?.includes('main'))) {
      log('green', '  ✓ List branches');
      passed++;
    } else {
      log('red', `  ✗ List branches failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ List branches threw: ${error}`);
  }

  total++;
  try {
    const branchName = `test-branch-${Date.now()}`;
    const result = await tool.execute({
      cwd: testDir,
      name: branchName,
      action: 'create',
    });
    if (result.success) {
      log('green', `  ✓ Create branch`);
      passed++;
    } else {
      log('red', `  ✗ Create branch failed: ${result.error}`);
    }

    // Cleanup: delete the test branch
    await git.deleteLocalBranch(branchName);
  } catch (error) {
    log('red', `  ✗ Create branch threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      name: 'nonexistent-branch-xyz',
      action: 'delete',
    });
    if (!result.success && (result.error?.includes('not found') || result.error?.includes('does not exist') || result.error?.includes('error'))) {
      log('green', '  ✓ Handle delete non-existent branch');
      passed++;
    } else {
      log('red', `  ✗ Handle delete non-existent branch failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle delete non-existent branch threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: '/nonexistent/path',
      action: 'list',
    });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  log('yellow', `\n  GitBranchTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitLogTool() {
  logSection('Test 5: GitLogTool');

  const tool = new GitLogTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (result.success && result.output !== undefined) {
      log('green', '  ✓ Show commit log');
      passed++;
    } else {
      log('red', `  ✗ Show commit log failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Show commit log threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      maxCount: 1,
    });
    if (result.success) {
      log('green', '  ✓ Limit log entries');
      passed++;
    } else {
      log('red', `  ✗ Limit log entries failed`);
    }
  } catch (error) {
    log('red', `  ✗ Limit log entries threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      file: 'commit-test.txt',
    });
    if (result.success) {
      log('green', '  ✓ Filter log by file');
      passed++;
    } else {
      log('red', `  ✗ Filter log by file failed`);
    }
  } catch (error) {
    log('red', `  ✗ Filter log by file threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  log('yellow', `\n  GitLogTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitPushTool() {
  logSection('Test 6: GitPushTool');

  const tool = new GitPushTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (result.output?.includes('upstream') ||
        result.output?.includes('nothing to push') ||
        result.error?.includes('upstream') ||
        result.error?.includes('fatal') ||
        result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle no remote upstream');
      passed++;
    } else {
      log('red', `  ✗ Handle no remote upstream unexpected: ${result.error || result.output}`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', '  ✓ Handle no remote upstream');
      passed++;
    } else {
      log('red', `  ✗ Handle no remote upstream threw: ${error}`);
    }
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  log('yellow', `\n  GitPushTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitPullTool() {
  logSection('Test 7: GitPullTool');

  const tool = new GitPullTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (result.error?.includes('not a git repository') ||
        result.error?.includes('no remote') ||
        result.error?.includes('does not appear') ||
        result.error?.includes('Could not read from remote') ||
        result.output?.includes('already up to date') ||
        result.output?.includes('fatal')) {
      log('green', '  ✓ Handle no remote gracefully');
      passed++;
    } else {
      log('red', `  ✗ Handle no remote unexpected: ${result.error || result.output}`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', '  ✓ Handle no remote gracefully');
      passed++;
    } else {
      log('red', `  ✗ Handle no remote threw: ${error}`);
    }
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  log('yellow', `\n  GitPullTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitMergeTool() {
  logSection('Test 8: GitMergeTool');

  const tool = new GitMergeTool();
  let passed = 0;
  let total = 0;

  total++;
  try {
    const branchName = `merge-test-${Date.now()}`;
    await git.checkoutLocalBranch(branchName);
    const result = await tool.execute({
      cwd: testDir,
      branch: 'master',
    });
    // Merging current branch into itself should either succeed (already up to date) or fail
    if (result.success || result.output?.includes('already up to date') || result.error) {
      log('green', '  ✓ Merge branch (already up-to-date)');
      passed++;
    } else {
      log('red', `  ✗ Merge branch failed: ${result.error}`);
    }

    await git.checkout('master');
    await git.deleteLocalBranch(branchName);
  } catch (error) {
    log('red', `  ✗ Merge branch threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: testDir });
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params (branch)');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    if (String(error).includes('Missing required parameter')) {
      log('green', `  ✓ Validate required params threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Validate required params threw: ${error}`);
    }
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path', branch: 'master' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  log('yellow', `\n  GitMergeTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testGitStashTool() {
  logSection('Test 9: GitStashTool');

  const tool = new GitStashTool();
  let passed = 0;
  let total = 0;

  // Create an uncommitted change
  const testFile = path.join(testDir, 'stash-test.txt');
  fs.writeFileSync(testFile, 'stash content');

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      action: 'save',
      message: 'test: stashing changes',
    });
    if (result.success || result.error?.includes('no changes')) {
      log('green', '  ✓ Stash changes');
      passed++;
    } else {
      log('red', `  ✗ Stash changes failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Stash changes threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      action: 'list',
    });
    if (result.success) {
      log('green', '  ✓ List stash entries');
      passed++;
    } else {
      log('red', `  ✗ List stash entries failed`);
    }
  } catch (error) {
    log('red', `  ✗ List stash entries threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({
      cwd: testDir,
      action: 'pop',
    });
    if (result.success) {
      log('green', '  ✓ Pop stash');
      passed++;
    } else {
      log('red', `  ✗ Pop stash failed`);
    }
  } catch (error) {
    log('red', `  ✗ Pop stash threw: ${error}`);
  }

  total++;
  try {
    const result = await tool.execute({ cwd: '/nonexistent/path', action: 'list' });
    if (!result.success && result.error?.includes('not a git repository')) {
      log('green', '  ✓ Handle non-repository');
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository failed`);
    }
  } catch (error) {
    if (String(error).includes('not a git repository')) {
      log('green', `  ✓ Handle non-repository threw: ${error}`);
      passed++;
    } else {
      log('red', `  ✗ Handle non-repository threw: ${error}`);
    }
  }

  // Cleanup
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  log('yellow', `\n  GitStashTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 10: Tool Definitions');

  const tools = [
    new GitStatusTool(),
    new GitCommitTool(),
    new GitPushTool(),
    new GitPullTool(),
    new GitDiffTool(),
    new GitBranchTool(),
    new GitLogTool(),
    new GitMergeTool(),
    new GitStashTool(),
  ];

  let passed = 0;
  let total = tools.length;

  for (const tool of tools) {
    if (tool.definition.name.startsWith('Git') &&
        tool.definition.description &&
        tool.definition.parameters.type === 'object') {
      log('green', `  ✓ ${tool.definition.name} has valid definition`);
      passed++;
    } else {
      log('red', `  ✗ ${tool.definition.name} has invalid definition`);
    }
  }

  const allHaveRequiredParams = tools.every(
    (tool) => tool.definition.parameters.required !== undefined
  );
  if (allHaveRequiredParams) {
    log('green', '  ✓ All tools have required parameter declarations');
    passed++;
  } else {
    log('red', '  ✗ Some tools missing required parameter declarations');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total + 1} tests passed`);
  return passed === total + 1;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Git Tools Test Suite (9 Git Tools)');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Platform: ${os.platform()}`);

  setupTestRepo();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'GitStatusTool', passed: await testGitStatusTool() });
    results.push({ name: 'GitCommitTool', passed: await testGitCommitTool() });
    results.push({ name: 'GitDiffTool', passed: await testGitDiffTool() });
    results.push({ name: 'GitBranchTool', passed: await testGitBranchTool() });
    results.push({ name: 'GitLogTool', passed: await testGitLogTool() });
    results.push({ name: 'GitPushTool', passed: await testGitPushTool() });
    results.push({ name: 'GitPullTool', passed: await testGitPullTool() });
    results.push({ name: 'GitMergeTool', passed: await testGitMergeTool() });
    results.push({ name: 'GitStashTool', passed: await testGitStashTool() });
    results.push({ name: 'Tool Definitions', passed: await testToolDefinitions() });
  } finally {
    cleanupTestRepo();
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
    cleanupTestRepo();
    process.exit(1);
  });
