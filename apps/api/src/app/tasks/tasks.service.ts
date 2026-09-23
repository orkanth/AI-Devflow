import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
  ) {}

  async findAll(projectId?: string): Promise<Task[]> {
    if (projectId) {
      return this.taskRepo.find({
        where: { projectId },
        relations: { assignee: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.taskRepo.find({
      relations: { assignee: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: { assignee: true, project: true },
    });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    // Validate project existence
    await this.projects.findOne(dto.projectId);

    // Validate assignee if provided
    const assigneeId = dto.assigneeId && dto.assigneeId.trim() !== '' ? dto.assigneeId : null;
    if (assigneeId) {
      await this.users.findOne(assigneeId);
    }

    const task = this.taskRepo.create({
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'todo',
      priority: dto.priority ?? 'medium',
      assigneeId,
    });

    return this.taskRepo.save(task);
  }
async update(id: string, dto: UpdateTaskDto): Promise<Task> {
  const task = await this.findOne(id);

  // REMOVE THIS BLOCK if UpdateTaskDto shouldn't have projectId:
  // if (dto.projectId) {
  //   await this.projects.findOne(dto.projectId);
  // }

  if (dto.assigneeId) {
    await this.users.findOne(dto.assigneeId);
  }

  const assigneeId =
    dto.assigneeId !== undefined
      ? dto.assigneeId && dto.assigneeId.trim() !== ''
        ? dto.assigneeId
        : null
      : task.assigneeId;

  Object.assign(task, dto, { assigneeId });
  return this.taskRepo.save(task);
}

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
    return { id, deleted: true };
  }
}