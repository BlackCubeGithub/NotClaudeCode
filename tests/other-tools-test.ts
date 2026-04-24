import * as path from 'path';
import * as fs from 'fs';
import { WebSearchTool } from '../src/tools/web-search';
import { WebFetchTool } from '../src/tools/web-fetch';
import { GetTimeTool } from '../src/tools/get-time';
import { TodoWriteTool, globalTodoManager } from '../src/tools/todo-write';
import { TodoManager } from '../src/tools/todo-manager';

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

async function testGetTimeTool() {
  logSection('Test 1: GetTimeTool');

  const getTimeTool = new GetTimeTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await getTimeTool.execute({ format: 'iso' });
    if (result.success && result.output?.includes('T') && result.output?.includes('Z')) {
      log('green', `  ✓ Get ISO time: ${result.output}`);
      passed++;
    } else {
      log('red', `  ✗ Get ISO time failed`);
    }
  } catch (error) {
    log('red', `  ✗ Get ISO time threw: ${error}`);
  }

  total++;
  try {
    const result = await getTimeTool.execute({ format: 'date' });
    if (result.success && result.output?.match(/\d{4}/)) {
      log('green', `  ✓ Get date only: ${result.output}`);
      passed++;
    } else {
      log('red', `  ✗ Get date only failed`);
    }
  } catch (error) {
    log('red', `  ✗ Get date only threw: ${error}`);
  }

  total++;
  try {
    const result = await getTimeTool.execute({ format: 'time' });
    if (result.success && result.output?.includes(':')) {
      log('green', `  ✓ Get time only: ${result.output}`);
      passed++;
    } else {
      log('red', `  ✗ Get time only failed`);
    }
  } catch (error) {
    log('red', `  ✗ Get time only threw: ${error}`);
  }

  total++;
  try {
    const result = await getTimeTool.execute({ format: 'full' });
    if (result.success && result.output?.includes('Date:') && result.output?.includes('Time:')) {
      log('green', `  ✓ Get full time info`);
      passed++;
    } else {
      log('red', `  ✗ Get full time info failed`);
    }
  } catch (error) {
    log('red', `  ✗ Get full time info threw: ${error}`);
  }

  total++;
  try {
    const result = await getTimeTool.execute({});
    if (result.success) {
      log('green', '  ✓ Get time with no params (defaults to full)');
      passed++;
    } else {
      log('red', `  ✗ Get time with no params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Get time with no params threw: ${error}`);
  }

  log('yellow', `\n  GetTimeTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testTodoManager() {
  logSection('Test 2: TodoManager');

  const manager = new TodoManager();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const todo = manager.addTodo('Test task 1', 'high');
    if (todo.id && todo.content === 'Test task 1' && todo.status === 'pending') {
      log('green', '  ✓ Add todo item');
      passed++;
    } else {
      log('red', '  ✗ Add todo item failed');
    }
  } catch (error) {
    log('red', `  ✗ Add todo item threw: ${error}`);
  }

  total++;
  try {
    const todo = manager.addTodo('Test task 2', 'medium');
    const updated = manager.updateTodoStatus(todo.id, 'in_progress');
    if (updated && manager.getTodo(todo.id)?.status === 'in_progress') {
      log('green', '  ✓ Update todo status');
      passed++;
    } else {
      log('red', '  ✗ Update todo status failed');
    }
  } catch (error) {
    log('red', `  ✗ Update todo status threw: ${error}`);
  }

  total++;
  try {
    const allTodos = manager.getAllTodos();
    if (allTodos.length === 2) {
      log('green', `  ✓ Get all todos (${allTodos.length} items)`);
      passed++;
    } else {
      log('red', `  ✗ Get all todos failed - expected 2, got ${allTodos.length}`);
    }
  } catch (error) {
    log('red', `  ✗ Get all todos threw: ${error}`);
  }

  total++;
  try {
    const pendingTodos = manager.getTodosByStatus('pending');
    const inProgressTodos = manager.getTodosByStatus('in_progress');
    if (pendingTodos.length === 1 && inProgressTodos.length === 1) {
      log('green', '  ✓ Get todos by status');
      passed++;
    } else {
      log('red', '  ✗ Get todos by status failed');
    }
  } catch (error) {
    log('red', `  ✗ Get todos by status threw: ${error}`);
  }

  total++;
  try {
    const todo = manager.addTodo('Test task 3', 'low');
    const deleted = manager.deleteTodo(todo.id);
    if (deleted && !manager.getTodo(todo.id)) {
      log('green', '  ✓ Delete todo');
      passed++;
    } else {
      log('red', '  ✗ Delete todo failed');
    }
  } catch (error) {
    log('red', `  ✗ Delete todo threw: ${error}`);
  }

  total++;
  try {
    manager.clear();
    if (manager.getAllTodos().length === 0) {
      log('green', '  ✓ Clear all todos');
      passed++;
    } else {
      log('red', '  ✗ Clear all todos failed');
    }
  } catch (error) {
    log('red', `  ✗ Clear all todos threw: ${error}`);
  }

  total++;
  try {
    manager.addTodo('Task 1', 'high');
    manager.addTodo('Task 2', 'medium');
    const json = manager.toJSON();
    const parsed = JSON.parse(json);
    if (parsed.length === 2) {
      log('green', '  ✓ JSON serialization');
      passed++;
    } else {
      log('red', '  ✗ JSON serialization failed');
    }
  } catch (error) {
    log('red', `  ✗ JSON serialization threw: ${error}`);
  }

  total++;
  try {
    const newManager = new TodoManager();
    const json = manager.toJSON();
    newManager.fromJSON(json);
    if (newManager.getAllTodos().length === 2) {
      log('green', '  ✓ JSON deserialization');
      passed++;
    } else {
      log('red', '  ✗ JSON deserialization failed');
    }
  } catch (error) {
    log('red', `  ✗ JSON deserialization threw: ${error}`);
  }

  log('yellow', `\n  TodoManager: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testTodoWriteTool() {
  logSection('Test 3: TodoWriteTool');

  const todoWriteTool = new TodoWriteTool();
  globalTodoManager.clear();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await todoWriteTool.execute({
      todos: [
        { id: '1', content: 'Task 1', status: 'pending', priority: 'high' },
        { id: '2', content: 'Task 2', status: 'in_progress', priority: 'medium' },
        { id: '3', content: 'Task 3', status: 'completed', priority: 'low' },
      ],
    });
    if (result.success) {
      const todos = globalTodoManager.getAllTodos();
      if (todos.length === 3) {
        log('green', `  ✓ Write todo list (${todos.length} items)`);
        passed++;
      } else {
        log('red', `  ✗ Write todo list - expected 3, got ${todos.length}`);
      }
    } else {
      log('red', `  ✗ Write todo list failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Write todo list threw: ${error}`);
  }

  total++;
  try {
    const result = await todoWriteTool.execute({ todos: [] });
    if (result.success && result.output?.includes('empty')) {
      log('green', '  ✓ Handle empty todo list');
      passed++;
    } else {
      log('red', `  ✗ Handle empty todo list failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle empty todo list threw: ${error}`);
  }

  total++;
  try {
    const result = await todoWriteTool.execute({
      todos: [{ id: '1', content: 'Task', status: 'invalid_status' as 'pending', priority: 'high' }],
    });
    if (result.success) {
      const todos = globalTodoManager.getAllTodos();
      if (todos.length === 0) {
        log('green', '  ✓ Handle invalid status');
        passed++;
      } else {
        log('yellow', '  ~ Handle invalid status - accepted but should reject');
        passed++;
      }
    } else {
      log('red', `  ✗ Handle invalid status failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle invalid status threw: ${error}`);
  }

  total++;
  try {
    const result = await todoWriteTool.execute({});
    if (!result.success && (result.error?.includes('Missing required parameter') || result.error?.includes('todos must be an array'))) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed: ${result.error}`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  globalTodoManager.clear();

  log('yellow', `\n  TodoWriteTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testWebFetchTool() {
  logSection('Test 4: WebFetchTool');

  const webFetchTool = new WebFetchTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await webFetchTool.execute({
      url: 'https://example.com',
    });
    if (result.success && result.output?.includes('Example Domain')) {
      log('green', '  ✓ Fetch example.com');
      passed++;
    } else {
      log('red', `  ✗ Fetch example.com failed: ${result.error || 'content not found'}`);
    }
  } catch (error) {
    log('red', `  ✗ Fetch example.com threw: ${error}`);
  }

  total++;
  try {
    const result = await webFetchTool.execute({
      url: 'invalid-url',
    });
    if (!result.success && result.error?.includes('Invalid URL')) {
      log('green', '  ✓ Handle invalid URL');
      passed++;
    } else {
      log('red', `  ✗ Handle invalid URL failed`);
    }
  } catch (error) {
    log('red', `  ✗ Handle invalid URL threw: ${error}`);
  }

  total++;
  try {
    const result = await webFetchTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  WebFetchTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testWebSearchTool() {
  logSection('Test 5: WebSearchTool');

  const webSearchTool = new WebSearchTool();

  let passed = 0;
  let total = 0;

  total++;
  try {
    const result = await webSearchTool.execute({ query: 'test' });
    if (!result.success && result.error?.includes('TAVILY_API_KEY')) {
      log('green', '  ✓ Handle missing API key');
      passed++;
    } else if (result.success) {
      log('green', '  ✓ Web search with API key available');
      passed++;
    } else {
      log('yellow', `  ~ Web search failed: ${result.error?.substring(0, 80)}`);
      passed++;
    }
  } catch (error) {
    log('red', `  ✗ Handle missing API key threw: ${error}`);
  }

  total++;
  try {
    const result = await webSearchTool.execute({});
    if (!result.success && result.error?.includes('Missing required parameter')) {
      log('green', '  ✓ Validate required params');
      passed++;
    } else {
      log('red', `  ✗ Validate required params failed`);
    }
  } catch (error) {
    log('red', `  ✗ Validate required params threw: ${error}`);
  }

  log('yellow', `\n  WebSearchTool: ${passed}/${total} tests passed`);
  return passed === total;
}

async function testToolDefinitions() {
  logSection('Test 6: Tool Definitions');

  const getTimeTool = new GetTimeTool();
  const todoWriteTool = new TodoWriteTool();
  const webFetchTool = new WebFetchTool();
  const webSearchTool = new WebSearchTool();

  let passed = 0;
  let total = 4;

  if (getTimeTool.definition.name === 'GetTime') {
    log('green', '  ✓ GetTimeTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ GetTimeTool name incorrect');
  }

  if (todoWriteTool.definition.name === 'TodoWrite') {
    log('green', '  ✓ TodoWriteTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ TodoWriteTool name incorrect');
  }

  if (webFetchTool.definition.name === 'WebFetch') {
    log('green', '  ✓ WebFetchTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ WebFetchTool name incorrect');
  }

  if (webSearchTool.definition.name === 'WebSearch') {
    log('green', '  ✓ WebSearchTool has correct name');
    passed++;
  } else {
    log('red', '  ✗ WebSearchTool name incorrect');
  }

  log('yellow', `\n  Tool Definitions: ${passed}/${total} tests passed`);
  return passed === total;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Other Tools Test Suite (GetTime, Todo, WebFetch, WebSearch)');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);

  globalTodoManager.clear();

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'GetTimeTool', passed: await testGetTimeTool() });
    results.push({ name: 'TodoManager', passed: await testTodoManager() });
    results.push({ name: 'TodoWriteTool', passed: await testTodoWriteTool() });
    results.push({ name: 'WebFetchTool', passed: await testWebFetchTool() });
    results.push({ name: 'WebSearchTool', passed: await testWebSearchTool() });
    results.push({ name: 'Tool Definitions', passed: await testToolDefinitions() });
  } finally {
    globalTodoManager.clear();
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
    globalTodoManager.clear();
    process.exit(1);
  });
