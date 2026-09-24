import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  // Fetch a user along with their associated projects
  async findOneWithProjects(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        projects: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByName(name: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { name: ILike(name.trim()) },
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const count = await this.userRepository.count();
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last user');
    }

    // Using entity remove instead of delete(id) triggers TypeORM cascade hooks if configured
    const user = await this.findOne(id);
    await this.userRepository.remove(user);

    return { id, deleted: true };
  }
}