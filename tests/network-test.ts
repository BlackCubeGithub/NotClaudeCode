import { fetchWithRetry, fetchJsonWithRetry, fetchTextWithRetry } from '../src/utils/retry';

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

async function testBasicFetch() {
  logSection('Test 1: Basic Fetch');
  try {
    log('yellow', 'Testing basic fetch to httpbin.org...');
    const response = await fetchWithRetry('https://httpbin.org/get', {}, { maxRetries: 2, timeout: 10000 });
    const data = await response.json() as { url: string };
    log('green', `✓ Success! Response from: ${data.url}`);
    return true;
  } catch (error) {
    log('red', `✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testJsonFetch() {
  logSection('Test 2: JSON Fetch');
  try {
    log('yellow', 'Testing JSON fetch to httpbin.org...');
    const data = await fetchJsonWithRetry<{ url: string }>(
      'https://httpbin.org/get',
      {},
      { maxRetries: 2, timeout: 10000 }
    );
    log('green', `✓ Success! Got JSON with url: ${data.url}`);
    return true;
  } catch (error) {
    log('red', `✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testTextFetch() {
  logSection('Test 3: Text Fetch');
  try {
    log('yellow', 'Testing text fetch to example.com...');
    const text = await fetchTextWithRetry(
      'https://example.com',
      {},
      { maxRetries: 2, timeout: 10000 }
    );
    log('green', `✓ Success! Got ${text.length} characters`);
    log('gray', `  Preview: ${text.substring(0, 100)}...`);
    return true;
  } catch (error) {
    log('red', `✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function testRetryOnServerError() {
  logSection('Test 4: Retry on Server Error (500)');
  const startTime = Date.now();
  try {
    log('yellow', 'Testing retry on 500 error (httpbin.org/status/500)...');
    log('gray', '  This should retry 2 times and then fail');
    await fetchWithRetry(
      'https://httpbin.org/status/500',
      {},
      { maxRetries: 2, timeout: 5000, baseDelay: 1000 }
    );
    log('red', '✗ Should have failed but succeeded');
    return false;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    log('green', `✓ Correctly failed after retries in ${elapsed}ms`);
    log('gray', `  Error: ${error instanceof Error ? error.message : String(error)}`);
    return true;
  }
}

async function testTimeout() {
  logSection('Test 5: Timeout Handling');
  const startTime = Date.now();
  try {
    log('yellow', 'Testing timeout with 2s limit on slow endpoint...');
    log('gray', '  This should timeout and fail');
    await fetchWithRetry(
      'https://httpbin.org/delay/10',
      {},
      { maxRetries: 1, timeout: 2000 }
    );
    log('red', '✗ Should have timed out but succeeded');
    return false;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
      log('green', `✓ Correctly timed out after ${elapsed}ms`);
      return true;
    } else {
      log('red', `✗ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

async function testMultipleAPIs() {
  logSection('Test 6: Multiple API Endpoints');
  const endpoints = [
    { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/models' },
    { name: 'Zhipu', url: 'https://open.bigmodel.cn/api/paas/v4/models' },
    { name: 'Qwen', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models' },
    { name: 'Kimi', url: 'https://api.moonshot.cn/v1/models' },
  ];

  const results: { name: string; success: boolean; time: number }[] = [];

  for (const endpoint of endpoints) {
    const startTime = Date.now();
    try {
      log('yellow', `Testing ${endpoint.name} API connectivity...`);
      const response = await fetchWithRetry(endpoint.url, {}, { maxRetries: 1, timeout: 5000 });
      const elapsed = Date.now() - startTime;
      
      if (response.ok || response.status === 401) {
        log('green', `  ✓ ${endpoint.name}: Connected (${elapsed}ms, status: ${response.status})`);
        results.push({ name: endpoint.name, success: true, time: elapsed });
      } else {
        log('yellow', `  ~ ${endpoint.name}: HTTP ${response.status} (${elapsed}ms)`);
        results.push({ name: endpoint.name, success: true, time: elapsed });
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      log('red', `  ✗ ${endpoint.name}: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ name: endpoint.name, success: false, time: elapsed });
    }
  }

  const successCount = results.filter(r => r.success).length;
  log('cyan', `\n  Summary: ${successCount}/${results.length} endpoints reachable`);
  
  return successCount > 0;
}

async function testTavilyAPI() {
  logSection('Test 7: Tavily API (if key available)');
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    log('yellow', '⚠ TAVILY_API_KEY not set, skipping test');
    return true;
  }

  try {
    log('yellow', 'Testing Tavily search API...');
    const startTime = Date.now();
    const data = await fetchJsonWithRetry<{ answer?: string; results?: unknown[] }>(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: 'test search',
          max_results: 1,
        }),
      },
      { maxRetries: 2, timeout: 15000 }
    );
    const elapsed = Date.now() - startTime;
    log('green', `✓ Tavily API working (${elapsed}ms)`);
    return true;
  } catch (error) {
    log('red', `✗ Tavily API failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('cyan', '  Network Stability Test Suite');
  console.log('═'.repeat(60));
  log('gray', `  Started at: ${new Date().toISOString()}`);

  const tests = [
    { name: 'Basic Fetch', fn: testBasicFetch },
    { name: 'JSON Fetch', fn: testJsonFetch },
    { name: 'Text Fetch', fn: testTextFetch },
    { name: 'Retry on Error', fn: testRetryOnServerError },
    { name: 'Timeout', fn: testTimeout },
    { name: 'Multiple APIs', fn: testMultipleAPIs },
    { name: 'Tavily API', fn: testTavilyAPI },
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
