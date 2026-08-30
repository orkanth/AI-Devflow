import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MemoryStore } from '../store/memory.store';
import { UsersService } from '../users/users.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly store: MemoryStore,
    private readonly users: UsersService
  ) {}

  findAll() {
    return this.store.projects;
  }

  findOne(id: string) {
    const project = this.store.projects.find((item) => item.id === id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  create(dto: CreateProjectDto) {
    this.users.findOne(dto.ownerId);
    const project = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      ownerId: dto.ownerId,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    this.store.projects.push(project);
    return project;
  }

  update(id: string, dto: UpdateProjectDto) {
    const project = this.findOne(id);
    Object.assign(project, dto);
    return project;
  }

  remove(id: string) {
    this.findOne(id);
    this.store.removeProject(id);
    return { id, deleted: true };
  }
}
