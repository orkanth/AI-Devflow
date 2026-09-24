import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ProjectsService } from '../projects/projects.service';
import { MemoryStore } from '../store/memory.store';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { ChatDto } from './ai.dto';

export interface AgentTrace {
  agent: string;
  reason: string;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
}

export interface ChatResult {
  answer: string;
  route: string;
  source: 'fastapi' | 'nestjs-fallback';
  llm?: boolean;
  model?: string | null;
  engine?: string;
  trace: AgentTrace[];
  contexts?: Array<{ title: string; score: number; content: string }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly store: MemoryStore,
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
    private readonly knowledge: KnowledgeService
  ) {}

  async status() {
    try {
      const response = await fetch(`${this.aiUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        throw new Error(`AI service HTTP ${response.status}`);
      }
      return await response.json();
    } catch {
      return {
        status: 'unreachable',
        service: 'ai-service',
        llm: { enabled: false, model: null, provider: null },
      };
    }
  }

  async chat(dto: ChatDto): Promise<ChatResult> {
    const projectId = await this.resolveProjectId(dto);
    try {
      const response = await fetch(`${this.aiUrl}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dto.message,
          project_id: projectId,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        throw new Error(`AI service HTTP ${response.status}`);
      }
      const payload = (await response.json()) as ChatResult;
      return {
        ...payload,
        source: 'fastapi',
        llm: payload.llm ?? false,
        model: payload.model ?? null,
        engine: payload.engine ?? 'langgraph',
      };
    } catch (error) {
      this.logger.warn(
        `FastAPI unavailable, using NestJS fallback: ${(error as Error).message}`
      );
      return await this.localSupervisor({ ...dto, projectId });
    }
  }

  /**
   * Same routing policy as the Python supervisor so the demo still works
   * when the AI process is down. Graceful degradation.
   */
  async localSupervisor(dto: ChatDto): Promise<ChatResult> {
    const text = dto.message.toLowerCase();
    if (
      /\btdd\b/.test(text) &&
      /(task|ticket)/.test(text)
    ) {
      return await this.tddTaskAgent(dto);
    }
    if (
      /(create|add).*(project)/.test(text) ||
      text.startsWith('create project')
    ) {
      return await this.projectAgent(dto);
    }
    if (/(edit|update|rename|assign).*(task|ticket)/.test(text)) {
      return await this.updateTaskAgent(dto);
    }
    if (
      /(create|add|open).*(task|ticket)/.test(text) ||
      text.startsWith('create task')
    ) {
      return await this.taskAgent(dto);
    }
    if (
      /(how many|analytics|metrics|status of tasks|dashboard)/.test(text)
    ) {
      return this.analyticsAgent();
    }
    return this.ragAgent(dto);
  }

  private async tddTaskAgent(dto: ChatDto): Promise<ChatResult> {
    const projectId = await this.resolveProjectId(dto);
    const docs = await this.knowledge.findAll(projectId);
    const toolCalls: AgentTrace['toolCalls'] = [
      {
        tool: 'list_knowledge',
        args: { projectId },
        result: docs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          originalName: doc.originalName,
        })),
      },
    ];
    if (!docs.length) {
      return {
        answer:
          'No TDD documents found for this project. Upload files on the TDD upload page, then run this prompt again.',
        route: 'task',
        source: 'nestjs-fallback',
        engine: 'nestjs',
        llm: false,
        model: null,
        trace: [
          {
            agent: 'task',
            reason: 'Create tasks from TDD — no documents yet.',
            toolCalls,
          },
        ],
      };
    }
    if (!projectId) {
      return {
        answer: 'Create a project first, then generate tasks from TDD.',
        route: 'task',
        source: 'nestjs-fallback',
        engine: 'nestjs',
        llm: false,
        model: null,
        trace: [
          {
            agent: 'task',
            reason: 'TDD task creation needs a project.',
            toolCalls,
          },
        ],
      };
    }
    const created = [];
    for (const doc of docs) {
      const title = `TDD: ${doc.title || doc.originalName}`;
      const task = await this.tasks.create({
        projectId,
        title,
        description: `Generated from TDD document ${doc.originalName}`,
        status: 'todo',
        priority: 'medium',
      });
      created.push(task);
      toolCalls.push({
        tool: 'create_task',
        args: { title, projectId, documentId: doc.id },
        result: task,
      });
    }
    return {
      answer: `Created ${created.length} task(s) from TDD documents: ${created
        .map((task) => `"${task.title}"`)
        .join(', ')}.`,
      route: 'task',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      trace: [
        {
          agent: 'task',
          reason: 'Matched create-tasks-from-TDD intent.',
          toolCalls,
        },
      ],
    };
  }

  private async projectAgent(dto: ChatDto): Promise<ChatResult> {
    const name =
      this.quoted(dto.message) ??
      this.after(dto.message, /project[:\s]+/i) ??
      'New project';
    const users = await this.users.findAll();
    const project = await this.projects.create({
      name,
      description: `Created by NestJS fallback from: ${dto.message}`,
      ownerId: users[0]?.id,
    });
    return {
      answer: `Created project "${project.name}".`,
      route: 'task',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      trace: [
        {
          agent: 'task',
          reason: 'Matched create-project intent.',
          toolCalls: [
            { tool: 'create_project', args: { name }, result: project },
          ],
        },
      ],
    };
  }

  private async updateTaskAgent(dto: ChatDto): Promise<ChatResult> {
    const tasks = await this.tasks.findAll(dto.projectId);
    const needle = this.quoted(dto.message)?.toLowerCase();
    const task =
      (needle
        ? tasks.find((item) => item.title.toLowerCase().includes(needle))
        : undefined) ??
      tasks.find((item) =>
        dto.message.toLowerCase().includes(item.title.toLowerCase())
      ) ??
      tasks[0];
    if (!task) {
      return {
        answer: 'Could not find a task to update. Create one first.',
        route: 'task',
        source: 'nestjs-fallback',
        engine: 'nestjs',
        llm: false,
        model: null,
        trace: [
          {
            agent: 'task',
            reason: 'Update intent with no matching task.',
            toolCalls: [],
          },
        ],
      };
    }
    const fields: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeId?: string;
    } = {};
    const text = dto.message.toLowerCase();
    if (/\b(todo|in_progress|in progress|done|blocked)\b/.test(text)) {
      fields.status = text.includes('blocked')
        ? 'blocked'
        : text.includes('done')
          ? 'done'
          : text.includes('progress')
            ? 'in_progress'
            : 'todo';
    }
    if (/\b(high|medium|low)\b/.test(text)) {
      fields.priority = text.includes('high')
        ? 'high'
        : text.includes('low')
          ? 'low'
          : 'medium';
    }
    const users = await this.users.findAll();
    const assignee = users.find((user) =>
      text.includes(user.name.toLowerCase())
    );
    if (assignee) {
      fields.assigneeId = assignee.id;
    }
    if (!Object.keys(fields).length) {
      const rename = this.quoted(dto.message);
      if (rename && rename.toLowerCase() !== task.title.toLowerCase()) {
        fields.title = rename;
      } else {
        fields.description = dto.message;
      }
    }
    const updated = await this.tasks.update(task.id, fields);
    return {
      answer: `Updated task "${updated.title}".`,
      route: 'task',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      trace: [
        {
          agent: 'task',
          reason: 'Matched update-task intent.',
          toolCalls: [
            {
              tool: 'update_task',
              args: { taskId: task.id, ...fields },
              result: updated,
            },
          ],
        },
      ],
    };
  }

  private async taskAgent(dto: ChatDto): Promise<ChatResult> {
    const projectId = await this.resolveProjectId(dto);
    if (!projectId) {
      return {
        answer: 'Create a project first, then ask the agent to create a task.',
        route: 'task',
        source: 'nestjs-fallback',
        engine: 'nestjs',
        llm: false,
        model: null,
        trace: [
          {
            agent: 'task',
            reason: 'Create-task intent without a project.',
            toolCalls: [],
          },
        ],
      };
    }
    const title =
      this.quoted(dto.message) ??
      this.after(dto.message, /task[:\s]+/i) ??
      dto.message.slice(0, 80);
    const task = await this.tasks.create({
      projectId,
      title,
      description: `Created by NestJS fallback task agent from: ${dto.message}`,
      status: 'todo',
      priority: 'medium',
    });
    return {
      answer: `Created task "${task.title}" in project ${projectId}.`,
      route: 'task',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      trace: [
        {
          agent: 'task',
          reason: 'Matched a write/create intent.',
          toolCalls: [
            { tool: 'create_task', args: { title, projectId }, result: task },
          ],
        },
      ],
    };
  }

  private ragAgent(dto: ChatDto): ChatResult {
    const hits = this.store.searchKnowledge(dto.message, dto.projectId, 3);
    const contexts = hits.map((hit) => ({
      title: hit.chunk.title,
      score: Number(hit.score.toFixed(4)),
      content: hit.chunk.content,
    }));
    const answer =
      contexts.length === 0
        ? 'No knowledge chunks matched that query.'
        : `Retrieved ${contexts.length} chunks. Top match: ${contexts[0].title} (score ${contexts[0].score}). ${contexts[0].content}`;
    return {
      answer,
      route: 'rag',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      contexts,
      trace: [
        {
          agent: 'rag',
          reason: 'Default route for knowledge / architecture questions.',
          toolCalls: [
            {
              tool: 'search_knowledge',
              args: { query: dto.message, projectId: dto.projectId },
              result: contexts,
            },
          ],
        },
      ],
    };
  }

  private analyticsAgent(): ChatResult {
    const stats = this.store.analytics();
    return {
      answer: `Workspace has ${stats.users} users, ${stats.projects} projects, ${stats.tasks} tasks (${JSON.stringify(stats.tasksByStatus)}), and ${stats.knowledgeChunks} knowledge chunks.`,
      route: 'analytics',
      source: 'nestjs-fallback',
      engine: 'nestjs',
      llm: false,
      model: null,
      trace: [
        {
          agent: 'analytics',
          reason: 'Matched a metrics / counting intent.',
          toolCalls: [
            { tool: 'workspace_analytics', args: {}, result: stats },
          ],
        },
      ],
    };
  }

  private async resolveProjectId(dto: ChatDto): Promise<string | undefined> {
    if (dto.projectId) {
      return dto.projectId;
    }
    const projects = await this.projects.findAll();
    return projects[0]?.id;
  }

  private quoted(message: string): string | undefined {
    const match = message.match(/['"]([^'"]+)['"]/);
    return match?.[1]?.trim();
  }

  private after(message: string, pattern: RegExp): string | undefined {
    const match = message.match(
      new RegExp(pattern.source + String.raw`['"]?([^'"\n.]+)`, pattern.flags)
    );
    return match?.[1]?.trim();
  }
}
