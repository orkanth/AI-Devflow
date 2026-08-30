import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Task } from '../domain/models';
import { ProjectsService } from '../projects/projects.service';
import { MemoryStore } from '../store/memory.store';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly store: MemoryStore,
    private readonly projects: ProjectsService
  ) {}

  findAll(projectId?: string) {
    if (!projectId) {
      return this.store.tasks;
    }
    return this.store.tasks.filter((task) => task.projectId === projectId);
  }

  findOne(id: string) {
    const task = this.store.tasks.find((item) => item.id === id);
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  create(dto: CreateTaskDto) {
    this.projects.findOne(dto.projectId);
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'todo',
      priority: dto.priority ?? 'medium',
      assigneeId: dto.assigneeId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.tasks.push(task);
    return task;
  }

  update(id: string, dto: UpdateTaskDto) {
    const task = this.findOne(id);
    Object.assign(task, dto, { updatedAt: new Date().toISOString() });
    return task;
  }
}
