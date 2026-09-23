import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ProjectsModule } from './projects/projects.module';
import { StoreModule } from './store/store.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import * as path from 'path';

@Module({
  imports: [
    // Loads the .env file globally across all modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '../../../../.env'),
      ],
    }),

    // Asynchronously configures TypeORM using ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USER', 'devflow'),
        password: configService.get<string>('DB_PASSWORD', 'devflow'),
        database: configService.get<string>('DB_NAME', 'devflow'),
        autoLoadEntities: true, // Automatically loads entities from feature modules
        synchronize: true,    // Set to false since your table already exists in PostgreSQL
      }),
    }),

    StoreModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    KnowledgeModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}