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
    await this.findOne(id);

    if (dto.assigneeId !== undefined && dto.assigneeId !== null) {
      await this.users.findOne(dto.assigneeId);
    }

    const updateData: Partial<Task> = {};

    if (dto.projectId !== undefined) {
      updateData.projectId = dto.projectId;
    }

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
    }

    if (dto.assigneeId !== undefined) {
      updateData.assigneeId =
        dto.assigneeId && dto.assigneeId.trim() !== ''
          ? dto.assigneeId
          : null;
    }

    console.log('UPDATE DATA:', updateData);

    await this.taskRepo.update(id, updateData);

    const updatedTask = await this.findOne(id);

    console.log('UPDATED TASK:', {
      id: updatedTask.id,
      assigneeId: updatedTask.assigneeId,
      assignee: updatedTask.assignee?.name,
    });

    return updatedTask;
  }
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
    return { id, deleted: true };
  }
}