import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IngestKnowledgeDto, SearchKnowledgeDto } from './knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.knowledge.findAll(projectId);
  }

  @Post('ingest')
  ingest(@Body() dto: IngestKnowledgeDto) {
    return this.knowledge.ingest(dto);
  }

  @Post('search')
  search(@Body() dto: SearchKnowledgeDto) {
    return this.knowledge.search(dto.query, dto.projectId);
  }
}
