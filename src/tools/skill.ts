import { BaseTool, ValidationError } from './base';
import { ToolDefinition, ToolResult } from '../types';
import { SkillManager } from '../core/skills/skill-manager';

export class SkillTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'Skill',
    description: `Execute a skill within the main conversation

Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke skills using this tool with the skill name only (no arguments)
- When you invoke a skill, you will see a message indicating the skill is loading
- The skill's prompt will expand and provide detailed instructions on how to complete the task

Important:
- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action
- NEVER just announce or mention a skill in your text response without actually calling this tool
- This is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- Only use skills that are available in the skill registry
- Do not invoke a skill that is already running

Available skills can be discovered by using the "list" action.`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The skill name (no arguments). E.g., "pdf" or "xlsx"',
        },
        action: {
          type: 'string',
          description: 'Action to perform: "execute" (default), "list", or "info"',
          enum: ['execute', 'list', 'info'],
        },
        variables: {
          type: 'object',
          description: 'Variables to pass to the skill',
        },
      },
      required: ['name'],
    },
  };

  private skillManager: SkillManager | null = null;

  setSkillManager(manager: SkillManager): void {
    this.skillManager = manager;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['name']);

      const skillName = params.name as string;
      const action = (params.action as string) || 'execute';
      const variables = (params.variables as Record<string, string>) || {};

      if (!this.skillManager) {
        return this.error('Skill manager not initialized');
      }

      if (action === 'list') {
        const skills = this.skillManager.getAllSkills();
        if (skills.length === 0) {
          return this.success('No skills available.');
        }
        const skillList = skills
          .map(s => `- **${s.name}**: ${s.description.split('\n')[0]}`)
          .join('\n');
        return this.success(`Available skills:\n${skillList}`);
      }

      if (action === 'info') {
        const skill = this.skillManager.getSkill(skillName);
        if (!skill) {
          return this.error(`Skill not found: ${skillName}`);
        }
        const info = [
          `# ${skill.name}`,
          '',
          `**Description**: ${skill.description}`,
          `**Source**: ${skill.source}`,
          skill.trigger?.command ? `**Command**: ${skill.trigger.command}` : '',
          skill.trigger?.filePattern ? `**File Pattern**: ${skill.trigger.filePattern}` : '',
          '',
          '## Steps',
          ...skill.steps.map((s, i) => `${i + 1}. ${s.description || s.prompt || s.tool || 'Unknown step'}`),
        ].filter(Boolean).join('\n');
        return this.success(info);
      }

      const skill = this.skillManager.getSkill(skillName);
      if (!skill) {
        const availableSkills = this.skillManager.getSkillNames();
        return this.error(
          `Skill not found: ${skillName}\nAvailable skills: ${availableSkills.join(', ') || 'none'}`
        );
      }

      const result = await this.skillManager.executeSkill(skillName, variables);

      if (result.success) {
        return this.success(
          `Skill "${skillName}" executed successfully.\n${result.output}`
        );
      } else {
        return this.error(
          `Skill "${skillName}" execution failed.\nErrors: ${result.errors.map(e => e.error).join(', ')}`
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.error(error.message);
      }
      return this.error(
        `Error executing skill: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
