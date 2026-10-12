import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { ProjectsService } from '../projects/projects.service';
import { MemoryStore } from '../store/memory.store';
import { DocumentEntity } from './knowledge.entity';
import { KnowledgeChunkEntity } from './knowledge-chunk.entity';
import * as path from 'path';
import {
  Injectable,
  NotFoundException,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly store: MemoryStore,

    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,

    @InjectRepository(KnowledgeChunkEntity)
    private readonly chunkRepo: Repository<KnowledgeChunkEntity>,

    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(projectId?: string): Promise<DocumentEntity[]> {
    if (projectId) {
      await this.projectsService.findOne(projectId);
      return this.docRepo.find({
        where: { projectId },
        order: { createdAt: 'DESC' },
      });
    }

    return this.docRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DocumentEntity> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }

  async saveDocument(
    projectId: string,
    file: Express.Multer.File,
    title?: string, // 1. Added title parameter here
  ): Promise<DocumentEntity> {
    await this.projectsService.findOne(projectId);

    const doc = this.docRepo.create({
      projectId,
      title: title || file.originalname.replace(/\.[^.]+$/, ''), // 2. Uses file.originalname
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath: file.path,
    });

    return this.docRepo.save(doc);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const doc = await this.findOne(id);

    if (fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (err) {
        console.error(`Failed to delete local file: ${doc.filePath}`, err);
      }
    }

    await this.docRepo.remove(doc);
    return { id, deleted: true };
  }

  async saveChunks(
    documentId: string,
    chunks: Array<{
      content: string;
      chunkIndex: number;
      embedding: number[];
    }>,
  ): Promise<{ documentId: string; saved: number }> {
    const doc = await this.findOne(documentId);

    if (chunks.length === 0) {
      throw new BadRequestException('At least one text chunk is required');
    }

    for (const chunk of chunks) {
      if (
        !chunk.content.trim() ||
        chunk.embedding.length !== 1536 ||
        !chunk.embedding.every(Number.isFinite)
      ) {
        throw new BadRequestException(
          'Each chunk must contain text and a valid 1536-dimensional embedding',
        );
      }
    }

    const saved = await this.chunkRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(KnowledgeChunkEntity);

      // Remove previous chunks when reprocessing this document.
      await repo.delete({ documentId: doc.id });

      const entities = chunks.map((chunk) =>
        repo.create({
          documentId: doc.id,
          projectId: doc.projectId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          embedding: chunk.embedding,
        }),
      );

      await repo.save(entities);

      return entities.length;
    });

    return { documentId: doc.id, saved };
  }

  async processDocument(
    documentId: string,
  ): Promise<{ documentId: string; saved: number }> {
    const doc = await this.findOne(documentId);

    try {
      // Resolve the path recorded when the file was uploaded.
      const filePath = path.resolve(doc.filePath);
      const fileBuffer = await fs.promises.readFile(filePath);

      const formData = new FormData();

      const fileBlob = new Blob([fileBuffer as unknown as BlobPart], {
        type: doc.mimeType,
      });

      formData.append('file', fileBlob, doc.originalName);
      formData.append('document_id', doc.id);
      formData.append('project_id', doc.projectId);

      const baseUrl = (
        process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000'
      ).replace(/\/+$/, '');

      const response = await fetch(`${baseUrl}/v1/knowledge/ingest`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(180_000),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`AI service returned ${response.status}: ${detail}`);
      }

      const result = (await response.json()) as {
        documentId: string;
        projectId: string;
        chunkCount: number;
        chunks: Array<{
          content: string;
          chunkIndex: number;
          embedding: number[];
        }>;
      };

      if (
        result.documentId !== doc.id ||
        result.projectId !== doc.projectId ||
        !Array.isArray(result.chunks) ||
        result.chunkCount !== result.chunks.length
      ) {
        throw new Error('Invalid response from AI ingestion service');
      }

      // Save the chunks and vectors to PostgreSQL.
      const saved = await this.saveChunks(doc.id, result.chunks);

      return { documentId: doc.id, saved: saved.saved };
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error);

      throw new BadGatewayException(
        'Document processing failed. Check the AI service and retry.',
      );
    }
  }
}
