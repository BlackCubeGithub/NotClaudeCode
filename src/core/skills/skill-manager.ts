import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Skill, SkillExecutionContext, SkillExecutionResult, SkillStep } from '../../types/skill';
import { SkillParser } from './skill-parser';
import { Tool } from '../../types';
import { debugLog } from '../../utils/debug';

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private parser: SkillParser;
  private tools: Map<string, Tool>;
  private workingDirectory: string;

  constructor(tools: Map<string, Tool>, workingDirectory: string = process.cwd()) {
    this.parser = new SkillParser();
    this.tools = tools;
    this.workingDirectory = workingDirectory;
  }

  loadBuiltInSkills(): void {
    const builtInPath = path.join(__dirname, 'built-in');
    const skills = this.parser.parseDirectory(builtInPath, 'built-in');
    for (const skill of skills) {
      this.skills.set(skill.name.toLowerCase(), skill);
      debugLog('SKILL', `Loaded built-in skill: ${skill.name}`);
    }
  }

  loadProjectSkills(projectPath?: string): void {
    const projectDir = projectPath || this.workingDirectory;
    const skillPaths = [
      path.join(projectDir, '.claude', 'skills'),
      path.join(projectDir, '.notclaude', 'skills'),
      path.join(projectDir, 'skills'),
    ];

    for (const skillPath of skillPaths) {
      if (fs.existsSync(skillPath)) {
        const skills = this.parser.parseDirectory(skillPath, 'project');
        for (const skill of skills) {
          this.skills.set(skill.name.toLowerCase(), skill);
          debugLog('SKILL', `Loaded project skill: ${skill.name} from ${skillPath}`);
        }
      }
    }

    const skillFile = path.join(projectDir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      const skill = this.parser.parseFile(skillFile, 'project');
      if (skill && skill.name) {
        this.skills.set(skill.name.toLowerCase(), skill);
        debugLog('SKILL', `Loaded project skill file: ${skill.name}`);
      }
    }
  }

  loadUserSkills(): void {
    const userSkillPath = path.join(os.homedir(), '.notclaude', 'skills');
    if (fs.existsSync(userSkillPath)) {
      const skills = this.parser.parseDirectory(userSkillPath, 'user');
      for (const skill of skills) {
        this.skills.set(skill.name.toLowerCase(), skill);
        debugLog('SKILL', `Loaded user skill: ${skill.name}`);
      }
    }
  }

  loadAllSkills(): void {
    this.loadBuiltInSkills();
    this.loadProjectSkills();
    this.loadUserSkills();
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.name.toLowerCase(), skill);
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name.toLowerCase());
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }

  hasSkill(name: string): boolean {
    return this.skills.has(name.toLowerCase());
  }

  findSkillByCommand(command: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.trigger?.command === command) {
        return skill;
      }
    }
    return undefined;
  }

  findSkillsByFilePattern(filePath: string): Skill[] {
    const matchingSkills: Skill[] = [];
    for (const skill of this.skills.values()) {
      if (skill.trigger?.filePattern) {
        const pattern = skill.trigger.filePattern;
        if (this.matchPattern(filePath, pattern)) {
          matchingSkills.push(skill);
        }
      }
    }
    return matchingSkills;
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '<<DOUBLE_STAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<DOUBLE_STAR>>/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(filePath);
  }

  async executeSkill(
    skillName: string,
    variables: Record<string, string> = {},
    onPrompt?: (prompt: string) => Promise<string>
  ): Promise<SkillExecutionResult> {
    const skill = this.getSkill(skillName);
    if (!skill) {
      return {
        success: false,
        output: `Skill not found: ${skillName}`,
        stepsExecuted: 0,
        errors: [{ step: 0, error: `Skill not found: ${skillName}` }],
        context: this.createContext(variables),
      };
    }

    return this.executeSkillSteps(skill, variables, onPrompt);
  }

  private async executeSkillSteps(
    skill: Skill,
    variables: Record<string, string>,
    onPrompt?: (prompt: string) => Promise<string>
  ): Promise<SkillExecutionResult> {
    const context = this.createContext(variables);
    const errors: Array<{ step: number; error: string }> = [];
    let stepsExecuted = 0;
    let output = '';

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const stepNumber = i + 1;

      try {
        const result = await this.executeStep(step, context, onPrompt);
        context.previousResults.set(`step_${stepNumber}`, result);
        stepsExecuted++;

        if (typeof result === 'string') {
          output += result + '\n';
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ step: stepNumber, error: errorMsg });
        debugLog('SKILL_ERROR', `Step ${stepNumber} failed: ${errorMsg}`);

        if (skill.onError === 'stop') {
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      output: output.trim(),
      stepsExecuted,
      errors,
      context,
    };
  }

  private async executeStep(
    step: SkillStep,
    context: SkillExecutionContext,
    onPrompt?: (prompt: string) => Promise<string>
  ): Promise<unknown> {
    const resolvedPrompt = this.resolveVariables(step.prompt || '', context.variables);

    switch (step.type) {
      case 'tool': {
        if (!step.tool) {
          throw new Error('Tool step missing tool name');
        }
        const tool = this.tools.get(step.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${step.tool}`);
        }
        const resolvedParams = this.resolveParams(step.params || {}, context);
        const result = await tool.execute(resolvedParams);
        if (!result.success) {
          throw new Error(result.error || 'Tool execution failed');
        }
        return result.output;
      }

      case 'prompt': {
        if (onPrompt) {
          return await onPrompt(resolvedPrompt);
        }
        context.messages.push({ role: 'user', content: resolvedPrompt });
        return resolvedPrompt;
      }

      case 'condition': {
        if (!step.condition) {
          throw new Error('Condition step missing condition');
        }
        const conditionResult = this.evaluateCondition(step.condition, context);
        return conditionResult;
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private createContext(variables: Record<string, string>): SkillExecutionContext {
    return {
      workingDirectory: this.workingDirectory,
      variables: { ...variables },
      previousResults: new Map(),
      messages: [],
    };
  }

  private resolveVariables(text: string, variables: Record<string, string>): string {
    let resolved = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      resolved = resolved.replace(regex, value);
    }
    resolved = resolved.replace(/\$\{workingDirectory\}/g, this.workingDirectory);
    return resolved;
  }

  private resolveParams(
    params: Record<string, unknown>,
    context: SkillExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveVariables(value, context.variables);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParams(value as Record<string, unknown>, context);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private evaluateCondition(condition: string, context: SkillExecutionContext): boolean {
    const resolved = this.resolveVariables(condition, context.variables);
    
    if (resolved === 'true') return true;
    if (resolved === 'false') return false;
    
    const comparisonMatch = resolved.match(/(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)/);
    if (comparisonMatch) {
      const [, left, op, right] = comparisonMatch;
      const leftVal = left.trim();
      const rightVal = right.trim();
      
      switch (op) {
        case '===':
        case '==':
          return leftVal === rightVal;
        case '!==':
        case '!=':
          return leftVal !== rightVal;
        case '>=':
          return parseFloat(leftVal) >= parseFloat(rightVal);
        case '<=':
          return parseFloat(leftVal) <= parseFloat(rightVal);
        case '>':
          return parseFloat(leftVal) > parseFloat(rightVal);
        case '<':
          return parseFloat(leftVal) < parseFloat(rightVal);
      }
    }
    
    return Boolean(resolved);
  }

  setWorkingDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  createSkillFromTemplate(name: string, description: string): string {
    return `# ${name}

${description}

## Trigger
- command: /${name.toLowerCase().replace(/\s+/g, '-')}

## Variables
- input: The input for this skill

## Steps
1. Process the input
   - prompt: Process the following input: \${input}

## On Error
- stop
`;
  }
}
