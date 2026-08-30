import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MemoryStore } from '../store/memory.store';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly store: MemoryStore) {}

  findAll() {
    return this.store.users;
  }

  findOne(id: string) {
    const user = this.store.users.find((item) => item.id === id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findByName(name: string) {
    const needle = name.trim().toLowerCase();
    return this.store.users.find((user) => user.name.toLowerCase() === needle);
  }

  create(dto: CreateUserDto) {
    const user = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date().toISOString(),
    };
    this.store.users.push(user);
    return user;
  }

  update(id: string, dto: UpdateUserDto) {
    const user = this.findOne(id);
    Object.assign(user, dto);
    return user;
  }

  remove(id: string) {
    this.findOne(id);
    if (this.store.users.length === 1) {
      throw new BadRequestException('Cannot delete the last user');
    }
    this.store.removeUser(id);
    return { id, deleted: true };
  }
}
