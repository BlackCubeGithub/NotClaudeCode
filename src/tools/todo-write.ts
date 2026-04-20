import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import { TodoManager, TodoItem } from './todo-manager';

export const globalTodoManager = new TodoManager();

export class TodoWriteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'TodoWrite',
    description:
      'Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The updated todo list',
          items: {
            type: 'object',
            description: 'A todo item',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the todo item',
              },
              content: {
                type: 'string',
                description: 'The task description',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: 'The status of the task',
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'The priority of the task',
              },
            },
            required: ['id', 'content', 'status', 'priority'],
          },
        },
      },
      required: ['todos'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['todos']);

      const todos = params.todos as Array<{
        id: string;
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        priority: 'high' | 'medium' | 'low';
      }>;

      if (!Array.isArray(todos)) {
        return this.error('todos must be an array');
      }

      globalTodoManager.clear();

      for (const todo of todos) {
        if (!todo.id || !todo.content || !todo.status || !todo.priority) {
          continue;
        }

        const validStatuses = ['pending', 'in_progress', 'completed'];
        const validPriorities = ['high', 'medium', 'low'];

        if (!validStatuses.includes(todo.status)) {
          continue;
        }
        if (!validPriorities.includes(todo.priority)) {
          continue;
        }

        const item = globalTodoManager.addTodo(todo.content, todo.priority);
        globalTodoManager.updateTodoStatus(item.id, todo.status);
      }

      const allTodos = globalTodoManager.getAllTodos();
      const output = this.formatTodoList(allTodos);

      return this.success(output);
    } catch (error) {
      return this.error(
        `Error managing todos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private formatTodoList(todos: TodoItem[]): string {
    if (todos.length === 0) {
      return 'Todo list is empty.';
    }

    const statusIcons: Record<string, string> = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
    };

    const priorityColors: Record<string, string> = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
    };

    const lines = ['📋 Todo List:', ''];

    const sortedTodos = [...todos].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const todo of sortedTodos) {
      const icon = statusIcons[todo.status];
      const priority = priorityColors[todo.priority];
      lines.push(`  ${icon} ${priority} ${todo.content}`);
    }

    const pending = todos.filter((t) => t.status === 'pending').length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    const completed = todos.filter((t) => t.status === 'completed').length;

    lines.push('');
    lines.push(`Summary: ${pending} pending, ${inProgress} in progress, ${completed} completed`);

    return lines.join('\n');
  }
}

export function getTodoManager(): TodoManager {
  return globalTodoManager;
}
