import { Injectable, NotFoundException } from '@nestjs/common'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { ProjectsService } from '../projects/projects.service'; 
import { MemoryStore } from '../store/memory.store'; 
import { DocumentEntity } from './knowledge.entity';  

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly store: MemoryStore,
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    private readonly projectsService: ProjectsService
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
}