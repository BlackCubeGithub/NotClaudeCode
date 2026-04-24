import * as os from 'os';
import { RunCommandTool, runningCommands } from '../src/tools/run-command';
import { CheckCommandStatusTool } from '../src/tools/check-command-status';
import { StopCommandTool } from '../src/tools/stop-command';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testRunCommandTool() {
  logSection('Test 1: RunCommandTool');

  const runCommandTool = new RunCommandTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'echo hello' : 'echo "hello"',
      blocking: true,
      requires_approval: false,
    });
    if (result.success && result.output?.includes('hello')) {
      log('green', '  ✓ Run blocking command');
      passed++;
    } else {
      log('red', `  ✗ Run blocking command failed: ${result.error || result.output}`);
    }
  } catch (error) {
    log('red', `  ✗ Run blocking command threw: ${error}`);
  }

  total++;
  try {
    const result = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'echo %PATH%' : 'echo $PATH',
      blocking: true,
      requires_approval: false,
    });
    if (result.success) {
      log('green', '  ✓ Run command with environment variable');
      passed++;
    } else {
      log('red', `  ✗ Run command with env var failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Run command with env var threw: ${error}`);
  }

  total++;
  try {
    const result = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'exit 1' : 'false',
      blocking: true,
      requires_approval: false,
    });
    if (!result.success) {
      log('green', '  ✓ Handle command failure');
      passed++;
    } else {
      log('red', `  ✗ Handle command failure - should have failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle command failure threw: ${error}`);
  }

  total++;
  try {
    const result = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'ping -n 5 localhost' : 'sleep 5',
      blocking: false,
      requires_approval: false,
    });
    if (result.success && result.output?.includes('Command started')) {
      log('green', '  ✓ Run non-blocking command');
      passed++;

      const match = result.output?.match(/ID:\s*([a-f0-9-]+)/i);
      if (match) {
        const commandId = match[1];
        runningCommands.delete(commandId);
      }
    } else {
      log('red', `  ✗ Run non-blocking command failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Run non-blocking command threw: ${error}`);
  }

  total++;
  try {
    const result = await runCommandTool.execute({
      command: 'echo test',
      blocking: true,
      requires_approval: false,
    });
    if (result.output?.includes('Command ID:')) {
      log('green', '  ✓ Command returns ID');
      passed++;
    } else {
      log('red', `  ✗ Command returns ID failed`);
    }
  } catch (error) {
    log('red', `  ✗ Command returns ID threw: ${error}`);
  }

  total++;
  try {
    const result = await runCommandTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  RunCommandTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testCheckCommandStatusTool() {
  logSection('Test 2: CheckCommandStatusTool');

  const runCommandTool = new RunCommandTool();
  const checkStatusTool = new CheckCommandStatusTool();

  let passed = 0;
  let total = 0;

  let commandId: string | null = null;

  total++;
  try {
    const startResult = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'ping -n 10 localhost' : 'sleep 10',
      blocking: false,
      requires_approval: false,
    });

    const match = startResult.output?.match(/ID:\s*([a-f0-9-]+)/i);
    if (match) {
      commandId = match[1];
    }

    await sleep(100);

    const result = await checkStatusTool.execute({ command_id: commandId });
    if (result.success && result.output?.includes('running')) {
      log('green', '  ✓ Check running command status');
      passed++;
    } else {
      log('red', `  ✗ Check running command status failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Check running command status threw: ${error}`);
  }

  total++;
  try {
    const result = await checkStatusTool.execute({ command_id: 'nonexistent-id' });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle non-existent command');
      passed++;
    } else {
      log('red', `  ✗ Handle non-existent command failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle non-existent command threw: ${error}`);
  }

  total++;
  try {
    const result = await checkStatusTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  if (commandId) {
    runningCommands.delete(commandId);
  }

  log('yellow', `\n  CheckCommandStatusTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testStopCommandTool() {
  logSection('Test 3: StopCommandTool');

  const runCommandTool = new RunCommandTool();
  const stopCommandTool = new StopCommandTool();

  let passed = 0;
  let total = 0;

  let commandId: string | null = null;

  total++;
  try {
    const startResult = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'ping -n 30 localhost' : 'sleep 30',
      blocking: false,
      requires_approval: false,
    });

    const match = startResult.output?.match(/ID:\s*([a-f0-9-]+)/i);
    if (match) {
      commandId = match[1];
    }

    await sleep(100);

    const result = await stopCommandTool.execute({ command_id: commandId });
    if (result.success && result.output?.includes('terminated')) {
      log('green', '  ✓ Stop running command');
      passed++;
    } else {
      log('red', `  ✗ Stop running command failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Stop running command threw: ${error}`);
  }

  total++;
  try {
    const result = await stopCommandTool.execute({ command_id: 'nonexistent-id' });
    if (!result.success && result.error?.includes('not found')) {
      log('green', '  ✓ Handle non-existent command');
      passed++;
    } else {
      log('red', `  ✗ Handle non-existent command failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle non-existent command threw: ${error}`);
  }

  total++;
  try {
    const result = await stopCommandTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  if (commandId) {
    runningCommands.delete(commandId);
  }

  log('yellow', `\n  StopCommandTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testCommandWorkflow() {
  logSection('Test 4: Command Workflow (Start -> Check -> Stop)');

  const runCommandTool = new RunCommandTool();
  const checkStatusTool = new CheckCommandStatusTool();
  const stopCommandTool = new StopCommandTool();

  let passed = 0;
  let total = 1;

  try {
    const startResult = await runCommandTool.execute({
      command: os.platform() === 'win32' ? 'ping -n 20 localhost' : 'sleep 20',
      blocking: false,
      requires_approval: false,
    });

    const match = startResult.output?.match(/ID:\s*([a-f0-9-]+)/i);
    const commandId = match ? match[1] : null;

    if (!commandId) {
      log('red', '  ✗ Failed to start command');
      return false;
    }

    await sleep(200);

    const checkResult = await checkStatusTool.execute({ command_id: commandId });
    if (!checkResult.success || !checkResult.output?.includes('running')) {
      log('red', '  ✗ Command not running after start');
      runningCommands.delete(commandId);
      return false;
    }

    const stopResult = await stopCommandTool.execute({ command_id: commandId });
    if (!stopResult.success) {
      log('red', '  ✗ Failed to stop command');
      return false;
    }

    await sleep(100);

    const finalCheckResult = await checkStatusTool.execute({ command_id: commandId });
    if (finalCheckResult.output?.includes('done') || finalCheckResult.output?.includes('-1')) {
      log('green', '  ✓ Complete workflow (Start -> Check -> Stop -> Verify)');
      passed++;
    } else {
      log('red', `  ✗ Final status check failed`);
    }

    runningCommands.delete(commandId);
  } catch (error) {
    log('red', `  ✗ Workflow threw: ${error}`);
  }

  log('yellow', `\n  Command Workflow: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 5: Tool Definitions');

  const runCommandTool = new RunCommandTool();
  const checkStatusTool = new CheckCommandStatusTool();
  const stopCommandTool = new StopCommandTool();

  let passed = 0;
  let total = 3;

  if (runCommandTool.definition.name === 'RunCommand') {
    log('green', '  ✓ RunCommandTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ RunCommandTool name incorrect');
  }

  if (checkStatusTool.definition.name === 'CheckCommandStatus') {
    log('green', '  ✓ CheckCommandStatusTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ CheckCommandStatusTool name incorrect');
  }

  if (stopCommandTool.definition.name === 'StopCommand') {
    log('green', '  ✓ StopCommandTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ StopCommandTool name incorrect');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Command Tools Test Suite (RunCommand, CheckStatus, Stop)');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);
  log('gray', `  Platform: ${os.platform()}`);

  runningCommands.clear();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'RunCommandTool', passed: await testRunCommandTool() });
    results.push({ name: 'CheckCommandStatusTool', passed: await testCheckCommandStatusTool() });
    results.push({ name: 'StopCommandTool', passed: await testStopCommandTool() });
    results.push({ name: 'Command Workflow', passed: await testCommandWorkflow() });
    results.push({ name: 'Tool Definitions', passed: await testToolDefinitions() });
  } finally {
    runningCommands.clear();
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
    runningCommands.clear();
    process.exit(1);
  });
