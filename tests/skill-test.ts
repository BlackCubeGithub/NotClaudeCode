import * as path from 'path';
import * as fs from 'fs';
import { SkillParser } from '../src/core/skills/skill-parser';
import { SkillManager } from '../src/core/skills/skill-manager';
import { SkillTool } from '../src/tools/skill';
import { Map } from '../src/types';

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

async function testSkillParser() {
  logSection('Skill Parser Tests');

  const parser = new SkillParser();

  const sampleSkill = `# Test Skill

This is a test skill for unit testing.

## Trigger
- command: /test

## Variables
- input: The input value
- output: The output format

## Steps
1. Read the input file
   - tool: Read
   - params: { "file_path": "\${input}" }

2. Process the content
   - prompt: Process the content from the previous step

## On Error
- continue
`;

  const skill = parser.parseString(sampleSkill, 'user');

  if (skill.name === 'Test Skill') {
    log('green', '✓ Skill name parsed correctly');
  } else {
    log('red', `✗ Skill name incorrect: ${skill.name}`);
  }

  if (skill.description.includes('test skill for unit testing')) {
    log('green', '✓ Skill description parsed correctly');
  } else {
    log('red', `✗ Skill description incorrect: ${skill.description}`);
  }

  if (skill.trigger?.command === '/test') {
    log('green', '✓ Trigger command parsed correctly');
  } else {
    log('red', `✗ Trigger command incorrect: ${skill.trigger?.command}`);
  }

  if (skill.variables && skill.variables.length === 2) {
    log('green', '✓ Variables parsed correctly');
  } else {
    log('red', `✗ Variables count incorrect: ${skill.variables?.length}`);
  }

  if (skill.steps.length === 2) {
    log('green', '✓ Steps count correct');
  } else {
    log('red', `✗ Steps count incorrect: ${skill.steps.length}`);
  }

  if (skill.steps[0].type === 'tool' && skill.steps[0].tool === 'Read') {
    log('green', '✓ First step parsed correctly');
  } else {
    log('red', `✗ First step incorrect: ${JSON.stringify(skill.steps[0])}`);
  }

  if (skill.steps[1].type === 'prompt') {
    log('green', '✓ Second step parsed correctly');
  } else {
    log('red', `✗ Second step incorrect: ${JSON.stringify(skill.steps[1])}`);
  }

  if (skill.onError === 'continue') {
    log('green', '✓ OnError parsed correctly');
  } else {
    log('red', `✗ OnError incorrect: ${skill.onError}`);
  }
}

async function testSkillManager() {
  logSection('Skill Manager Tests');

  const tools = new Map<string, any>();
  const manager = new SkillManager(tools, process.cwd());

  const testSkillContent = `# Code Review

Review code for quality and issues.

## Trigger
- command: /review

## Steps
1. Analyze the code
   - prompt: Analyze this code for issues

## On Error
- stop
`;

  const tempDir = path.join(__dirname, 'temp-skills');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const skillFile = path.join(tempDir, 'code-review.md');
  fs.writeFileSync(skillFile, testSkillContent);

  const parser = new SkillParser();
  const skill = parser.parseFile(skillFile, 'project');

  if (skill && skill.name === 'Code Review') {
    log('green', '✓ Skill loaded from file correctly');
  } else {
    log('red', `✗ Skill loading failed: ${skill?.name}`);
  }

  manager.registerSkill(skill!);

  if (manager.hasSkill('Code Review')) {
    log('green', '✓ Skill registered successfully');
  } else {
    log('red', '✗ Skill registration failed');
  }

  const retrievedSkill = manager.getSkill('Code Review');
  if (retrievedSkill && retrievedSkill.name === 'Code Review') {
    log('green', '✓ Skill retrieved successfully');
  } else {
    log('red', '✗ Skill retrieval failed');
  }

  const allSkills = manager.getAllSkills();
  if (allSkills.length === 1) {
    log('green', '✓ getAllSkills returns correct count');
  } else {
    log('red', `✗ getAllSkills count incorrect: ${allSkills.length}`);
  }

  const foundByCommand = manager.findSkillByCommand('/review');
  if (foundByCommand && foundByCommand.name === 'Code Review') {
    log('green', '✓ findSkillByCommand works correctly');
  } else {
    log('red', '✗ findSkillByCommand failed');
  }

  fs.unlinkSync(skillFile);
  fs.rmdirSync(tempDir);
}

async function testSkillTool() {
  logSection('Skill Tool Tests');

  const tool = new SkillTool();

  if (tool.definition.name === 'Skill') {
    log('green', '✓ SkillTool name correct');
  } else {
    log('red', `✗ SkillTool name incorrect: ${tool.definition.name}`);
  }

  if (tool.definition.parameters.required.includes('name')) {
    log('green', '✓ SkillTool requires name parameter');
  } else {
    log('red', '✗ SkillTool name parameter not required');
  }

  const tools = new Map<string, any>();
  const manager = new SkillManager(tools, process.cwd());
  tool.setSkillManager(manager);

  const listResult = await tool.execute({ name: 'dummy', action: 'list' });
  if (listResult.success) {
    log('green', '✓ SkillTool list action works');
  } else {
    log('red', `✗ SkillTool list action failed: ${listResult.error}`);
  }

  const infoResult = await tool.execute({ name: 'nonexistent', action: 'info' });
  if (!infoResult.success && infoResult.error?.includes('not found')) {
    log('green', '✓ SkillTool info action handles missing skill');
  } else {
    log('red', '✗ SkillTool info action did not handle missing skill');
  }
}

async function testBuiltInSkills() {
  logSection('Built-in Skills Tests');

  const builtInPath = path.join(__dirname, '..', 'src', 'core', 'skills', 'built-in');
  
  if (fs.existsSync(builtInPath)) {
    log('green', '✓ Built-in skills directory exists');
    
    const files = fs.readdirSync(builtInPath).filter(f => f.endsWith('.md'));
    log('cyan', `  Found ${files.length} built-in skill files:`);
    
    for (const file of files) {
      log('gray', `    - ${file}`);
    }
    
    const parser = new SkillParser();
    const skills = parser.parseDirectory(builtInPath, 'built-in');
    
    if (skills.length > 0) {
      log('green', `✓ ${skills.length} built-in skills parsed successfully`);
      
      for (const skill of skills) {
        if (skill.name && skill.steps.length > 0) {
          log('green', `  ✓ ${skill.name}: ${skill.steps.length} steps`);
        } else {
          log('red', `  ✗ Invalid skill: ${skill.name || 'unnamed'}`);
        }
      }
    } else {
      log('yellow', '! No built-in skills found');
    }
  } else {
    log('yellow', '! Built-in skills directory not found');
  }
}

async function main() {
  log('cyan', '\n🧪 Running Skill System Tests\n');

  await testSkillParser();
  await testSkillManager();
  await testSkillTool();
  await testBuiltInSkills();

  log('cyan', '\n✅ All tests completed!\n');
}

main().catch(console.error);
