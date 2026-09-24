import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { KnowledgeService } from './knowledge.service';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/tdd';
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

@Controller('knowledge') // <--- Make sure this is 'knowledge'
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // Handles GET /api/knowledge and GET /api/knowledge?projectId=...
  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.knowledgeService.findAll(projectId);
  }

  // Handles POST /api/knowledge/upload?projectId=...
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storage as any,
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @Query('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title? : string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.knowledgeService.saveDocument(projectId, file, title);
  }

  // Handles DELETE /api/knowledge/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.knowledgeService.remove(id);
  }
}