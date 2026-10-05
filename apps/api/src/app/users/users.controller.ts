import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  // =================================================================
  // 1. STATIC & SPECIFIC ROUTES (MUST BE DECLARED FIRST)
  // =================================================================

  @Get('search')
  async search(@Query('query') query: string) {
    if (!query) {
      throw new BadRequestException('Query parameter is required.');
    }
    const cleanQuery = decodeURIComponent(query).trim();
    const user = await this.users.findByIdentifier(cleanQuery);
    if (!user) {
      throw new BadRequestException(`User "${cleanQuery}" not found.`);
    }
    return user;
  }
@Get('by-identifier/:identifier')
async findByIdentifier(@Param('identifier') identifier: string) {
  const cleanId = decodeURIComponent(identifier).trim();
  const user = await this.users.findByIdentifier(cleanId);
  
  if (!user) {
    throw new NotFoundException(`User "${cleanId}" not found`);
  }
  
  return user;
}
  @Patch('by-identifier/:identifier')
  async updateByIdentifier(
    @Param('identifier') identifier: string,
    @Body() dto: UpdateUserDto,
  ) {
    const cleanId = decodeURIComponent(identifier).trim();
    return this.users.updateByIdentifier(cleanId, dto);
  }

  @Delete('by-identifier/:identifier')
  async removeByIdentifier(@Param('identifier') identifier: string) {
    const cleanId = decodeURIComponent(identifier).trim();
    return this.users.removeByIdentifier(cleanId);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  // =================================================================
  // 2. PARAMETRIC UUID ROUTES (MUST BE DECLARED LAST)
  // =================================================================

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.remove(id);
  }
}