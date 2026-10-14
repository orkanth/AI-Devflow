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
    const assigneeId =
      dto.assigneeId && dto.assigneeId.trim() !== '' ? dto.assigneeId : null;

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

    // Save the task first
    const savedTask = await this.taskRepo.save(task);

    // Reload with assignee and project relations
    const createdTask = await this.findOne(savedTask.id);

    // Notify only if the task was created with an assignee
    if (createdTask.assigneeId) {
      try {
        await this.notifyTaskAssigned(createdTask);
      } catch (error) {
        console.error(
          'Task creation notification failed:',
          error instanceof Error ? error.message : error,
        );
      }
    }

    return createdTask;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const originalTask = await this.findOne(id);

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
        dto.assigneeId && dto.assigneeId.trim() !== '' ? dto.assigneeId : null;
    }

    await this.taskRepo.update(id, updateData);

    const updatedTask = await this.findOne(id);

    const assigneeChanged =
      updateData.assigneeId !== undefined &&
      updateData.assigneeId !== originalTask.assigneeId;

    console.log('[N8N DEBUG] Original assignee:', originalTask.assigneeId);
    console.log('[N8N DEBUG] New assignee:', updatedTask.assigneeId);
    console.log('[N8N DEBUG] Assignee changed:', assigneeChanged);
    if (assigneeChanged && updatedTask.assigneeId) {
      try {
        await this.notifyTaskAssigned(updatedTask);
      } catch (error) {
        // Notification failure must not undo a successful assignment.
        console.error(
          'Task assignment notification failed:',
          error instanceof Error ? error.message : error,
        );
      }
    }

    return updatedTask;
  }

  private async notifyTaskAssigned(task: Task): Promise<void> {
    const webhookUrl = process.env.N8N_TASK_ASSIGNED_WEBHOOK_URL;

    console.log('[N8N DEBUG] notifyTaskAssigned called');

    console.log(
      '[N8N DEBUG] Webhook URL:',
      process.env.N8N_TASK_ASSIGNED_WEBHOOK_URL,
    );
    if (!webhookUrl) {
      console.warn('n8n webhook URL is not configured.');
      return;
    }

    const email = task.assignee?.email;

    if (!email) {
      console.warn(`No email found for task ${task.id}.`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        project: task.project?.name ?? task.projectId,
        assignee: task.assignee?.name ?? 'Assignee',
        email,
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n returned HTTP ${response.status}`);
    }

    console.log(`Task assignment event sent to n8n: ${task.id}`);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
    return { id, deleted: true };
  }
}
