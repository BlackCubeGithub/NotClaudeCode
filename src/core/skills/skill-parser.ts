import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillStep, SkillVariable } from '../../types/skill';

export class SkillParser {
  parseMarkdown(content: string, filePath: string, source: 'built-in' | 'project' | 'user'): Skill {
    const lines = content.split('\n');
    const skill: Skill = {
      name: '',
      description: '',
      steps: [],
      source,
      filePath,
    };

    let currentSection = '';
    let stepContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('# ')) {
        skill.name = trimmedLine.slice(2).trim();
        continue;
      }

      if (trimmedLine.startsWith('## ')) {
        if (currentSection === 'Steps' && stepContent.length > 0) {
          this.processStepContent(skill, stepContent);
          stepContent = [];
        }
        currentSection = trimmedLine.slice(3).trim().toLowerCase();
        continue;
      }

      if (currentSection === 'description') {
        if (skill.description) {
          skill.description += '\n' + trimmedLine;
        } else {
          skill.description = trimmedLine;
        }
        continue;
      }

      if (currentSection === 'trigger') {
        this.parseTrigger(skill, trimmedLine);
        continue;
      }

      if (currentSection === 'variables') {
        this.parseVariable(skill, trimmedLine);
        continue;
      }

      if (currentSection === 'steps') {
        if (/^\d+\.\s/.test(trimmedLine)) {
          if (stepContent.length > 0) {
            this.processStepContent(skill, stepContent);
          }
          stepContent = [trimmedLine];
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('  ')) {
          stepContent.push(trimmedLine);
        } else if (trimmedLine && stepContent.length > 0) {
          stepContent.push(trimmedLine);
        }
        continue;
      }

      if (currentSection === 'on_error') {
        if (trimmedLine.toLowerCase().includes('continue')) {
          skill.onError = 'continue';
        } else if (trimmedLine.toLowerCase().includes('stop')) {
          skill.onError = 'stop';
        } else if (trimmedLine.toLowerCase().includes('rollback')) {
          skill.onError = 'rollback';
        }
        continue;
      }

      if (currentSection === 'version') {
        skill.version = trimmedLine;
        continue;
      }

      if (currentSection === 'author') {
        skill.author = trimmedLine;
        continue;
      }
    }

    if (stepContent.length > 0) {
      this.processStepContent(skill, stepContent);
    }

    return skill;
  }

  private parseTrigger(skill: Skill, line: string): void {
    if (!skill.trigger) {
      skill.trigger = {};
    }

    if (line.startsWith('- command:')) {
      skill.trigger.command = line.replace('- command:', '').trim();
    } else if (line.startsWith('- file pattern:')) {
      skill.trigger.filePattern = line.replace('- file pattern:', '').trim();
    } else if (line.startsWith('- keywords:')) {
      const keywordsStr = line.replace('- keywords:', '').trim();
      skill.trigger.keywords = keywordsStr.split(',').map(k => k.trim());
    }
  }

  private parseVariable(skill: Skill, line: string): void {
    if (!line.startsWith('- ') && !line.startsWith('  ')) return;

    if (!skill.variables) {
      skill.variables = [];
    }

    const varMatch = line.match(/^-\s*(\w+)(?:\s*:\s*(.+))?$/);
    if (varMatch) {
      const variable: SkillVariable = {
        name: varMatch[1],
        description: varMatch[2] || '',
      };
      skill.variables.push(variable);
    }
  }

  private processStepContent(skill: Skill, lines: string[]): void {
    if (lines.length === 0) return;

    const firstLine = lines[0];
    const stepMatch = firstLine.match(/^(\d+)\.\s+(.+)$/);
    if (!stepMatch) return;

    const stepDescription = stepMatch[2];
    const step: SkillStep = {
      type: 'prompt',
      description: stepDescription,
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('- tool:')) {
        step.type = 'tool';
        step.tool = line.replace('- tool:', '').trim();
      } else if (line.startsWith('- params:')) {
        const paramsStr = line.replace('- params:', '').trim();
        try {
          step.params = JSON.parse(paramsStr);
        } catch {
          step.params = { value: paramsStr };
        }
      } else if (line.startsWith('- prompt:')) {
        step.type = 'prompt';
        step.prompt = line.replace('- prompt:', '').trim();
      } else if (line.startsWith('- condition:')) {
        step.type = 'condition';
        step.condition = line.replace('- condition:', '').trim();
      } else if (line.startsWith('- max_iterations:')) {
        step.maxIterations = parseInt(line.replace('- max_iterations:', '').trim(), 10);
      }
    }

    if (step.type === 'prompt' && !step.prompt && stepDescription) {
      step.prompt = stepDescription;
    }

    skill.steps.push(step);
  }

  parseFile(filePath: string, source: 'built-in' | 'project' | 'user' = 'project'): Skill | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parseMarkdown(content, filePath, source);
    } catch (error) {
      console.error(`Error parsing skill file ${filePath}:`, error);
      return null;
    }
  }

  parseDirectory(dirPath: string, source: 'built-in' | 'project' | 'user' = 'project'): Skill[] {
    const skills: Skill[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return skills;
    }

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.md') || file === 'SKILL.md') {
        const filePath = path.join(dirPath, file);
        const skill = this.parseFile(filePath, source);
        if (skill && skill.name) {
          skills.push(skill);
        }
      }
    }

    return skills;
  }

  parseString(content: string, source: 'built-in' | 'project' | 'user' = 'user'): Skill {
    return this.parseMarkdown(content, '', source);
  }
}
