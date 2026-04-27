export interface SkillTrigger {
  command?: string;
  filePattern?: string;
  keywords?: string[];
}

export interface SkillStep {
  type: 'tool' | 'prompt' | 'condition' | 'loop';
  tool?: string;
  params?: Record<string, unknown>;
  prompt?: string;
  condition?: string;
  steps?: SkillStep[];
  maxIterations?: number;
  description?: string;
}

export interface SkillVariable {
  name: string;
  description: string;
  default?: string;
  required?: boolean;
}

export interface Skill {
  name: string;
  description: string;
  version?: string;
  author?: string;
  trigger?: SkillTrigger;
  variables?: SkillVariable[];
  steps: SkillStep[];
  onError?: 'continue' | 'stop' | 'rollback';
  source: 'built-in' | 'project' | 'user';
  filePath?: string;
}

export interface SkillExecutionContext {
  workingDirectory: string;
  variables: Record<string, string>;
  previousResults: Map<string, unknown>;
  messages: Array<{ role: string; content: string }>;
}

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  stepsExecuted: number;
  errors: Array<{ step: number; error: string }>;
  context: SkillExecutionContext;
}

export interface SkillRegistry {
  skills: Map<string, Skill>;
  builtInSkills: string[];
  projectSkills: string[];
}
