import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  KnowledgeChunk,
  Project,
  Task,
  User,
} from '../domain/models';
import { cosineSimilarity, embed } from './embeddings';

@Injectable()
export class MemoryStore {
  users: User[] = [];
  projects: Project[] = [];
  tasks: Task[] = [];
  chunks: KnowledgeChunk[] = [];

  constructor() {
    this.seed();
  }

  reset(): void {
    this.users = [];
    this.projects = [];
    this.tasks = [];
    this.chunks = [];
    this.seed();
  }

  searchKnowledge(query: string, projectId?: string, k = 4) {
    const queryVector = embed(query);
    const corpus = projectId
      ? this.chunks.filter((c) => c.projectId === projectId)
      : this.chunks;
    return corpus
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryVector, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  analytics() {
    const byStatus = this.tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
    const byPriority = this.tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.priority] = (acc[task.priority] ?? 0) + 1;
      return acc;
    }, {});
    return {
      users: this.users.length,
      projects: this.projects.length,
      tasks: this.tasks.length,
      knowledgeChunks: this.chunks.length,
      tasksByStatus: byStatus,
      tasksByPriority: byPriority,
    };
  }

  removeUser(id: string): void {
    const fallback = this.users.find((user) => user.id !== id);
    this.users = this.users.filter((user) => user.id !== id);
    if (fallback) {
      for (const project of this.projects) {
        if (project.ownerId === id) {
          project.ownerId = fallback.id;
        }
      }
    }
    for (const task of this.tasks) {
      if (task.assigneeId === id) {
        task.assigneeId = undefined;
      }
    }
  }

  removeProject(id: string): void {
    this.projects = this.projects.filter((project) => project.id !== id);
    this.tasks = this.tasks.filter((task) => task.projectId !== id);
    this.chunks = this.chunks.filter((chunk) => chunk.projectId !== id);
  }

  removeTask(id: string): void {
    this.tasks = this.tasks.filter((task) => task.id !== id);
  }

  private seed(): void {
    const now = new Date().toISOString();
    const ada: User = {
      id: randomUUID(),
      name: 'Ada Lovelace',
      email: 'ada@devflow.ai',
      role: 'engineer',
      createdAt: now,
    };
    const grace: User = {
      id: randomUUID(),
      name: 'Grace Hopper',
      email: 'grace@devflow.ai',
      role: 'pm',
      createdAt: now,
    };
    this.users.push(ada, grace);

    const platform: Project = {
      id: randomUUID(),
      name: 'DevFlow Platform',
      description: 'Interview prototype for an agentic engineering PM platform.',
      ownerId: grace.id,
      status: 'active',
      createdAt: now,
    };
    const ragLab: Project = {
      id: randomUUID(),
      name: 'RAG Lab',
      description: 'Knowledge retrieval experiments with pgvector-style search.',
      ownerId: ada.id,
      status: 'active',
      createdAt: now,
    };
    this.projects.push(platform, ragLab);

    const taskSeeds: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        projectId: platform.id,
        title: 'Design NestJS domain modules',
        description: 'Users, Projects, and Tasks as the system of record.',
        status: 'done',
        priority: 'high',
        assigneeId: ada.id,
      },
      {
        projectId: platform.id,
        title: 'Wire FastAPI LangGraph supervisor',
        description: 'Route chat to task, RAG, and analytics agents.',
        status: 'in_progress',
        priority: 'high',
        assigneeId: ada.id,
      },
      {
        projectId: ragLab.id,
        title: 'Ingest architecture notes',
        description: 'Chunk docs and store embeddings for retrieval.',
        status: 'todo',
        priority: 'medium',
        assigneeId: grace.id,
      },
      {
        projectId: ragLab.id,
        title: 'Blocked: production embedding provider',
        description: 'Waiting on API key for a hosted embedding model.',
        status: 'blocked',
        priority: 'low',
      },
    ];
    for (const seed of taskSeeds) {
      this.tasks.push({
        ...seed,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      });
    }

    const docs = [
      {
        projectId: platform.id,
        title: 'Why NestJS owns Users, Projects, Tasks',
        source: 'architecture.md',
        content:
          'NestJS is the business API layer. CRUD for users, projects, and tasks lives here so authorization, validation, and transactional writes stay in one place. The Python AI service must never become the system of record.',
      },
      {
        projectId: platform.id,
        title: 'LangGraph supervisor pattern',
        source: 'agents.md',
        content:
          'A supervisor graph routes each user request to a specialist agent. The task agent uses tool calling against NestJS. The RAG agent searches pgvector embeddings. The analytics agent aggregates PostgreSQL-style metrics.',
      },
      {
        projectId: ragLab.id,
        title: 'pgvector cosine search',
        source: 'rag.md',
        content:
          'pgvector stores embedding columns as vector types and supports cosine, L2, and inner-product distance. RAG retrieves the top-k chunks, then the language model answers using only that context. Evaluation checks faithfulness to retrieved chunks.',
      },
      {
        projectId: ragLab.id,
        title: 'MCP tool calling',
        source: 'mcp.md',
        content:
          'Model Context Protocol exposes tools with JSON schemas. Agents call tools instead of inventing side effects. In DevFlow the create_task and search_knowledge tools are registered in an MCP-style registry and executed against NestJS.',
      },
    ];
    for (const doc of docs) {
      this.chunks.push({
        id: randomUUID(),
        ...doc,
        embedding: embed(`${doc.title} ${doc.content}`),
        createdAt: now,
      });
    }
  }
}
