import { Body, Controller, Get, Post } from '@nestjs/common';
import { MemoryStore } from '../store/memory.store';
import { ChatDto } from './ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly store: MemoryStore
  ) {}

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.ai.chat(dto);
  }

  @Get('analytics')
  analytics() {
    return this.store.analytics();
  }
}
