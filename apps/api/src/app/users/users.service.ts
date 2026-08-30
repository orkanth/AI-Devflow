import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MemoryStore } from '../store/memory.store';
import { CreateUserDto } from './users.dto';

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

  create(dto: CreateUserDto) {
    const user = {
      id: randomUUID(),
      ...dto,
      createdAt: new Date().toISOString(),
    };
    this.store.users.push(user);
    return user;
  }
}
