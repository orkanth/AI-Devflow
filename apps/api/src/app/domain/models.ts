export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'engineer' | 'pm' | 'admin';
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  priority: TaskPriority;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * KnowledgeChunk is the RAG unit of storage.
 * In PostgreSQL + pgvector this maps to:
 *   embedding vector(64)
 * The in-memory store keeps the same shape so you can swap adapters later.
 */
export interface KnowledgeChunk {
  id: string;
  projectId: string;
  title: string;
  content: string;
  embedding: number[];
  source: string;
  createdAt: string;
}
