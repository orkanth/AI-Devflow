import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { DocumentEntity } from './knowledge.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeChunkEntity } from './knowledge-chunk.entity';


@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, KnowledgeChunkEntity]), 
       ProjectsModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
