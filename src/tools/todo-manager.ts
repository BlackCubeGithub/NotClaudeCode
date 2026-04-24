export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
}

export interface TodoState {
  todos: TodoItem[];
}

export class TodoManager {
  private todos: Map<string, TodoItem> = new Map();

  addTodo(
    content: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): TodoItem {
    const id = `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const todo: TodoItem = {
      id,
      content,
      status: 'pending',
      priority,
      createdAt: Date.now(),
    };
    this.todos.set(id, todo);
    return todo;
  }

  updateTodoStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): boolean {
    const todo = this.todos.get(id);
    if (todo) {
      todo.status = status;
      return true;
    }
    return false;
  }

  getTodo(id: string): TodoItem | undefined {
    return this.todos.get(id);
  }

  getAllTodos(): TodoItem[] {
    return Array.from(this.todos.values());
  }

  getTodosByStatus(status: 'pending' | 'in_progress' | 'completed'): TodoItem[] {
    return this.getAllTodos().filter((t) => t.status === status);
  }

  deleteTodo(id: string): boolean {
    return this.todos.delete(id);
  }

  clear(): void {
    this.todos.clear();
  }

  toJSON(): string {
    return JSON.stringify(this.getAllTodos(), null, 2);
  }

  fromJSON(json: string): void {
    try {
      const todos = JSON.parse(json) as TodoItem[];
      this.todos.clear();
      for (const todo of todos) {
        this.todos.set(todo.id, todo);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }
}
