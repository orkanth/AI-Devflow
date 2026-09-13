import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProjectsService } from '../projects/projects.service';
import { embed } from '../store/embeddings';
import { MemoryStore } from '../store/memory.store';
import { IngestKnowledgeDto } from './knowledge.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly store: MemoryStore,
    private readonly projects: ProjectsService
  ) {}

  findAll(projectId?: string) {
    const chunks = projectId
      ? this.store.chunks.filter((chunk) => chunk.projectId === projectId)
      : this.store.chunks;
    return chunks.map(({ embedding, ...rest }) => ({
      ...rest,
      embeddingDim: embedding.length,
    }));
  }

  ingest(dto: IngestKnowledgeDto) {
    this.projects.findOne(dto.projectId);
    const chunk = {
      id: randomUUID(),
      projectId: dto.projectId,
      title: dto.title,
      content: dto.content,
      source: dto.source ?? 'manual',
      embedding: embed(`${dto.title} ${dto.content}`),
      createdAt: new Date().toISOString(),
    };
    this.store.chunks.push(chunk);
    const { embedding, ...rest } = chunk;
    return { ...rest, embeddingDim: embedding.length };
  }

  search(query: string, projectId?: string, k = 4) {
    return this.store.searchKnowledge(query, projectId, k).map((hit) => ({
      id: hit.chunk.id,
      projectId: hit.chunk.projectId,
      title: hit.chunk.title,
      content: hit.chunk.content,
      source: hit.chunk.source,
      score: Number(hit.score.toFixed(4)),
    }));
  }
}
