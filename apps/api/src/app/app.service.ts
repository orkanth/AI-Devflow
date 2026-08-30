import { Injectable } from '@nestjs/common';
import { MemoryStore } from './store/memory.store';

@Injectable()
export class AppService {
  constructor(private readonly store: MemoryStore) {}

  getData() {
    return {
      name: 'DevFlow AI',
      message: 'NestJS business API is online',
      architecture: {
        frontend: 'Angular',
        api: 'NestJS',
        ai: 'FastAPI + LangGraph supervisor',
        data: 'PostgreSQL + pgvector (in-memory adapter by default)',
      },
      stats: this.store.analytics(),
    };
  }
}
