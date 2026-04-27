import { Tool } from '../types';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { EditTool } from './edit';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { LSTool } from './ls';
import { RunCommandTool } from './run-command';
import { CheckCommandStatusTool } from './check-command-status';
import { StopCommandTool } from './stop-command';
import { TodoWriteTool } from './todo-write';
import { WebSearchTool } from './web-search';
import { WebFetchTool } from './web-fetch';
import { GetTimeTool } from './get-time';
import { SkillTool } from './skill';
import { GitStatusTool } from './git/git-status';
import { GitCommitTool } from './git/git-commit';
import { GitPushTool } from './git/git-push';
import { GitPullTool } from './git/git-pull';
import { GitDiffTool } from './git/git-diff';
import { GitBranchTool } from './git/git-branch';
import { GitLogTool } from './git/git-log';
import { GitMergeTool } from './git/git-merge';
import { GitStashTool } from './git/git-stash';

export function getAllTools(): Tool[] {
  return [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new GlobTool(),
    new GrepTool(),
    new LSTool(),
    new RunCommandTool(),
    new CheckCommandStatusTool(),
    new StopCommandTool(),
    new TodoWriteTool(),
    new WebSearchTool(),
    new WebFetchTool(),
    new GetTimeTool(),
    new SkillTool(),
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
}
