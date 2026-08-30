import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId?: string;
}

export interface KnowledgeDoc {
  id: string;
  projectId: string;
  title: string;
  content: string;
  source: string;
  embeddingDim: number;
}

export interface ChatResult {
  answer: string;
  route: string;
  source: string;
  trace: Array<{
    agent: string;
    reason: string;
    toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  }>;
  contexts?: Array<{ title: string; score: number; content: string }>;
}

export interface WorkspaceStats {
  users: number;
  projects: number;
  tasks: number;
  knowledgeChunks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  health() {
    return this.http.get<{ name: string; stats: WorkspaceStats }>(this.base);
  }

  users() {
    return this.http.get<User[]>(`${this.base}/users`);
  }

  projects() {
    return this.http.get<Project[]>(`${this.base}/projects`);
  }

  createProject(body: { name: string; description: string; ownerId: string }) {
    return this.http.post<Project>(`${this.base}/projects`, body);
  }

  tasks(projectId?: string) {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.http.get<Task[]>(`${this.base}/tasks${params}`);
  }

  createTask(body: {
    projectId: string;
    title: string;
    description: string;
    priority?: string;
  }) {
    return this.http.post<Task>(`${this.base}/tasks`, body);
  }

  knowledge() {
    return this.http.get<KnowledgeDoc[]>(`${this.base}/knowledge`);
  }

  ingest(body: { projectId: string; title: string; content: string }) {
    return this.http.post(`${this.base}/knowledge/ingest`, body);
  }

  search(query: string) {
    return this.http.post(`${this.base}/knowledge/search`, { query });
  }

  analytics() {
    return this.http.get<WorkspaceStats>(`${this.base}/ai/analytics`);
  }

  chat(message: string, projectId?: string): Observable<ChatResult> {
    return this.http.post<ChatResult>(`${this.base}/ai/chat`, {
      message,
      projectId,
    });
  }
}
