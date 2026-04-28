/**
 * ConfigManager 测试套件
 * 运行: npx ts-node tests/config-manager-test.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigManager } from '../src/core/config-manager';

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

function assert(condition: boolean, message: string) {
  if (condition) {
    log('green', `  PASS: ${message}`);
  } else {
    log('red', `  FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    log('green', `  PASS: ${message}`);
  } else {
    log('red', `  FAIL: ${message}`);
    log('gray', `    Expected: ${JSON.stringify(expected)}`);
    log('gray', `    Actual:   ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}

const testDir = path.join(os.tmpdir(), `notclaude-config-test-${Date.now()}`);

function setup() {
  fs.mkdirSync(testDir, { recursive: true });
}

function cleanup() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function main() {
  setup();

  logSection('ConfigManager Test Suite');

  // ── Test 1: Empty directory — no config ──────────────────────────────
  {
    logSection('Test 1: No config file');
    const manager = new ConfigManager(testDir);
    const result = manager.load();
    assert(result.sources.length === 0, 'No sources when no config exists');
    assert(result.errors.length === 0, 'No errors when no config exists');
    assertEqual(manager.getConfig(), {}, 'Empty config returned');
  }

  // ── Test 2: NOTCLAUDECODE.md parsing ────────────────────────────────────────
  {
    logSection('Test 2: NOTCLAUDECODE.md parsing');
    // Clean up any leftover files from previous tests
    for (const f of ['NOTCLAUDECODE.md', '.notclaudecode.json', '.notclaudecode.local.json']) {
      const p = path.join(testDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const mdPath = path.join(testDir, 'NOTCLAUDECODE.md');
    const mdContent = [
      '# Project Overview',
      '',
      'A TypeScript Node.js project.',
      '',
      '## Languages',
      '- TypeScript, Node.js',
      '',
      '## Code Style',
      'Use strict TypeScript with 2-space indentation.',
      '',
      '## Rules',
      '- Always run lint before commits',
      '- Use absolute paths',
      '',
      '## Commands',
      '- /test: npm run test',
      '- /build: npm run build',
      '',
      '## Forbidden Operations',
      '- Force push without confirmation',
      '- Deleting production data',
    ].join('\n');
    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    const manager = new ConfigManager(testDir);
    const result = manager.load();
    assert(result.sources.length === 1, 'One source loaded');
    assert(result.sources[0].path.includes('NOTCLAUDECODE.md'), 'NOTCLAUDECODE.md is the source');
    assertEqual(manager.getConfig().overview, 'A TypeScript Node.js project.', 'Overview parsed');
    assertEqual(manager.getConfig().languages, ['TypeScript', 'Node.js'], 'Languages parsed');
    assertEqual(
      manager.getConfig().codeStyle,
      'Use strict TypeScript with 2-space indentation.',
      'Code style parsed'
    );
    assertEqual(manager.getConfig().rules, [
      'Always run lint before commits',
      'Use absolute paths',
    ], 'Rules parsed');
    assertEqual(manager.getConfig().commands, {
      '/test': 'npm run test',
      '/build': 'npm run build',
    }, 'Commands parsed');
    assertEqual(
      manager.getConfig().forbidden?.length,
      2,
      'Forbidden rules count'
    );
  }

  // ── Test 3: .notclaudecode.json parsing ────────────────────────────────────
  {
    logSection('Test 3: .notclaudecode.json parsing');
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    const jsonContent = {
      overview: 'JSON configured project',
      languages: ['Rust', 'WebAssembly'],
      codeStyle: 'Follow rustfmt guidelines',
      commands: { '/fmt': 'cargo fmt' },
      rules: ['Enable clippy warnings'],
      forbidden: [
        { name: 'unsafe_code', message: 'Do not use unsafe code in production.' },
      ],
      checks: [
        {
          type: 'pre_commit',
          command: 'cargo clippy',
          required: true,
          description: 'Run clippy before commit',
        },
      ],
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8');

    const manager = new ConfigManager(testDir);
    const result = manager.load();
    assertEqual(
      manager.getConfig().overview,
      'JSON configured project',
      'JSON overview parsed'
    );
    assertEqual(
      manager.getConfig().languages,
      ['Rust', 'WebAssembly'],
      'JSON languages parsed'
    );
    assertEqual(
      manager.getConfig().commands?.['/fmt'],
      'cargo fmt',
      'JSON commands merged'
    );
    assertEqual(
      manager.getConfig().checks?.[0].type,
      'pre_commit',
      'Check config parsed'
    );
    assertEqual(result.sources.length, 2, 'Both NOTCLAUDECODE.md and .notclaudecode.json loaded');
  }

  // ── Test 4: JSON overrides Markdown ─────────────────────────────────
  {
    logSection('Test 4: JSON overrides Markdown');
    const mdPath = path.join(testDir, 'NOTCLAUDECODE.md');
    const jsonPath = path.join(testDir, '.notclaudecode.json');

    fs.writeFileSync(mdPath, '# Overview\n\nMarkdown project\n\n## Rules\n- From markdown', 'utf-8');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ overview: 'JSON project', rules: ['From json'] }),
      'utf-8'
    );

    const manager = new ConfigManager(testDir);
    manager.load();
    // JSON overrides Markdown values
    assertEqual(manager.getConfig().overview, 'JSON project', 'JSON overrides overview');
    // Rules is array — JSON completely replaces Markdown array
    assertEqual(manager.getConfig().rules, ['From json'], 'JSON replaces rules array');
  }

  // ── Test 5: toSystemPrompt() ─────────────────────────────────────────
  {
    logSection('Test 5: toSystemPrompt()');
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        overview: 'Test project',
        languages: ['TypeScript'],
        codeStyle: 'Use Prettier',
        commands: { '/lint': 'npm run lint' },
        rules: ['Be concise'],
        forbidden: [{ name: 'dangerous', tool: 'RunCommand', paramPattern: '"command":"rm -rf', message: 'No dangerous ops' }],
        checks: [{ type: 'pre_push', command: 'npm run build', required: true }],
      }),
      'utf-8'
    );

    const manager = new ConfigManager(testDir);
    manager.load();
    const prompt = manager.toSystemPrompt();

    assert(prompt.includes('## Project Overview'), 'Contains overview section');
    assert(prompt.includes('Test project'), 'Contains overview content');
    assert(prompt.includes('## Languages'), 'Contains languages section');
    assert(prompt.includes('TypeScript'), 'Contains language');
    assert(prompt.includes('/lint'), 'Contains command alias');
    assert(prompt.includes('npm run lint'), 'Contains command value');
    assert(prompt.includes('## Project Rules'), 'Contains rules section');
    assert(prompt.includes('Be concise'), 'Contains rule');
    assert(prompt.includes('## Forbidden Operations'), 'Contains forbidden section');
    assert(prompt.includes('## Automatic Checks'), 'Contains checks section');
    assert(prompt.includes('[REQUIRED]'), 'Contains required badge');
  }

  // ── Test 6: isForbidden() ────────────────────────────────────────────
  {
    logSection('Test 6: isForbidden()');
    for (const f of ['NOTCLAUDECODE.md', '.notclaudecode.json', '.notclaudecode.local.json']) {
      const p = path.join(testDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        forbidden: [
          { name: 'force_push', tool: 'GitPush', paramPattern: '"force":true', message: 'No force push.' },
          { name: 'delete_prod', tool: 'Write', paramPattern: '/prod', message: 'Do not write to production paths.' },
        ],
      }),
      'utf-8'
    );

    const manager = new ConfigManager(testDir);
    manager.load();

    const r1 = manager.isForbidden('GitPush', { force: true });
    assert(r1.forbidden === true, 'Force push is forbidden');
    assert((r1.message ?? '').includes('No force push'), 'Correct message for force push');

    const r2 = manager.isForbidden('Write', { path: '/prod/delete.txt' });
    assert(r2.forbidden === true, 'Write to /prod is forbidden');
    assert((r2.message ?? '').includes('production paths'), 'Correct message for prod write');

    const r3 = manager.isForbidden('Read', { file_path: '/safe/file.ts' });
    assertEqual(r3.forbidden, false, 'Safe read is not forbidden');
  }

  // ── Test 7: getChecks() ──────────────────────────────────────────────
  {
    logSection('Test 7: getChecks()');
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        checks: [
          { type: 'pre_commit', command: 'npm run lint', required: true },
          { type: 'pre_push', command: 'npm run build', required: true },
          { type: 'always', command: 'echo heartbeat', required: false },
        ],
      }),
      'utf-8'
    );

    const manager = new ConfigManager(testDir);
    manager.load();

    const preCommit = manager.getChecks('pre_commit');
    assertEqual(preCommit.length, 2, 'pre_commit check + always check returned');
    assertEqual(preCommit[0].command, 'npm run lint', 'Correct pre_commit command');

    const prePush = manager.getChecks('pre_push');
    assertEqual(prePush.length, 2, 'pre_push check + always check returned');

    const always = manager.getChecks('always');
    assertEqual(always.length, 1, 'Only always check for always type');
  }

  // ── Test 8: getCommand() ─────────────────────────────────────────────
  {
    logSection('Test 8: getCommand()');
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ commands: { '/build': 'npm run build' } }), 'utf-8');

    const manager = new ConfigManager(testDir);
    manager.load();
    assertEqual(manager.getCommand('/build'), 'npm run build', 'Get command by alias');
    assertEqual(manager.getCommand('/nonexistent'), undefined, 'Unknown alias returns undefined');
  }

  // ── Test 9: reload() ────────────────────────────────────────────────
  {
    logSection('Test 9: reload()');
    for (const f of ['NOTCLAUDECODE.md', '.notclaudecode.json', '.notclaudecode.local.json']) {
      const p = path.join(testDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ overview: 'Version 1' }), 'utf-8');

    const manager = new ConfigManager(testDir);
    manager.load();
    assertEqual(manager.getConfig().overview, 'Version 1', 'Initial version loaded');

    // Update the file
    fs.writeFileSync(jsonPath, JSON.stringify({ overview: 'Version 2' }), 'utf-8');
    const result = manager.reload();
    assertEqual(manager.getConfig().overview, 'Version 2', 'Reload picks up changes');
    assert(result.sources.length === 1, 'Reload has source');
  }

  // ── Test 10: local override ───────────────────────────────────────────
  {
    logSection('Test 10: Local override (.notclaudecode.local.json)');
    for (const f of ['NOTCLAUDECODE.md', '.notclaudecode.json', '.notclaudecode.local.json']) {
      const p = path.join(testDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const mdPath = path.join(testDir, 'NOTCLAUDECODE.md');
    const localPath = path.join(testDir, '.notclaudecode.local.json');

    fs.writeFileSync(mdPath, '# Overview\n\nProject from NOTCLAUDECODE.md', 'utf-8');
    fs.writeFileSync(localPath, JSON.stringify({ overview: 'Local override' }), 'utf-8');

    const manager = new ConfigManager(testDir);
    manager.load();
    assertEqual(
      manager.getConfig().overview,
      'Local override',
      'Local config overrides project config'
    );
    assertEqual(
      manager.getSources().map((s) => path.basename(s.path)),
      ['NOTCLAUDECODE.md', '.notclaudecode.local.json'],
      'Both sources loaded in order'
    );
  }

  // ── Test 11: Project root detection ───────────────────────────────────
  {
    logSection('Test 11: Project root detection');
    for (const f of ['NOTCLAUDECODE.md', '.notclaudecode.json', '.notclaudecode.local.json']) {
      const p = path.join(testDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const jsonPath = path.join(testDir, '.notclaudecode.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ overview: 'Root test' }), 'utf-8');

    const manager = new ConfigManager(testDir);
    manager.load();
    assertEqual(
      manager.getProjectRoot(),
      testDir,
      'Project root is set to config directory'
    );
  }

  cleanup();

  logSection('Test Suite Complete');
  if (process.exitCode === 1) {
    log('red', '\n  Some tests failed.\n');
  } else {
    log('green', '\n  All tests passed!\n');
  }
}

main().catch((err) => {
  log('red', `\n  Unexpected error: ${err.message}\n`);
  cleanup();
  process.exit(1);
});
