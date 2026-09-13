import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AiController } from './ai.controller';
import { AiGateway } from './ai.gateway';
import { AiService } from './ai.service';

@Module({
  imports: [TasksModule],
  controllers: [AiController],
  providers: [AiService, AiGateway],
  exports: [AiService],
})
export class AiModule {}
