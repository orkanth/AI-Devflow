import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; 
import { UsersService } from '../users/users.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';
import { Project } from './projects.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly users: UsersService,
  ) {}

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

async create(dto: CreateProjectDto): Promise<Project> {
  const ownerId = dto.ownerId && dto.ownerId.trim() !== '' ? dto.ownerId : null;

  if (ownerId) {
    await this.users.findOne(ownerId);
  }

  const project = this.projectRepo.create({
    name: dto.name,
    description: dto.description,
    ownerId: ownerId,
    status: dto.status ?? 'active',
    priority: dto.priority ?? 'medium',
  });

  return this.projectRepo.save(project);
}

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
    return { id, deleted: true };
  }
}