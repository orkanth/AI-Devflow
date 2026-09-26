import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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

  // --- STATIC / SPECIFIC ROUTES (MUST COME FIRST) ---

  @Get('search')
  async search(@Query('query') query: string) {
    if (!query) {
      throw new BadRequestException('Query parameter is required');
    }
    const user = await this.users.findByIdentifier(query);
    if (!user) {
      throw new BadRequestException(`User "${query}" not found.`);
    }
    return user;
  }

  @Get('by-identifier/:identifier')
  async findByIdentifier(@Param('identifier') identifier: string) {
    const cleanId = decodeURIComponent(identifier).trim();
    return this.users.findByIdentifier(cleanId);
  }

  @Patch('by-identifier/:identifier')
  async updateByIdentifier(
    @Param('identifier') identifier: string,
    @Body() dto: UpdateUserDto,
  ) {
    const cleanId = decodeURIComponent(identifier).trim();
    return this.users.updateByIdentifier(cleanId, dto);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  // --- PARAMETRIC UUID ROUTES (MUST COME LAST) ---

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