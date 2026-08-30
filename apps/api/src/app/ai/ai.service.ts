import { Injectable, Logger } from '@nestjs/common';
import { MemoryStore } from '../store/memory.store';
import { TasksService } from '../tasks/tasks.service';
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
    private readonly tasks: TasksService
  ) {}

  async chat(dto: ChatDto): Promise<ChatResult> {
    try {
      const response = await fetch(`${this.aiUrl}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dto.message,
          project_id: dto.projectId,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`AI service HTTP ${response.status}`);
      }
      const payload = (await response.json()) as ChatResult;
      return { ...payload, source: 'fastapi' };
    } catch (error) {
      this.logger.warn(
        `FastAPI unavailable, using NestJS fallback: ${(error as Error).message}`
      );
      return this.localSupervisor(dto);
    }
  }

  /**
   * Same routing policy as the Python supervisor so the demo still works
   * when the AI process is down. Interview talking point: graceful degradation.
   */
  localSupervisor(dto: ChatDto): ChatResult {
    const text = dto.message.toLowerCase();
    if (
      /(create|add|open).*(task|ticket)|assign/.test(text) ||
      text.startsWith('create task')
    ) {
      return this.taskAgent(dto);
    }
    if (
      /(how many|analytics|metrics|status of tasks|dashboard)/.test(text)
    ) {
      return this.analyticsAgent();
    }
    return this.ragAgent(dto);
  }

  private taskAgent(dto: ChatDto): ChatResult {
    const projectId = dto.projectId ?? this.store.projects[0]?.id;
    const titleMatch = dto.message.match(/task[:\s]+["']?([^"'\n.]+)["']?/i);
    const title = titleMatch?.[1]?.trim() ?? dto.message.slice(0, 80);
    const task = this.tasks.create({
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
}
