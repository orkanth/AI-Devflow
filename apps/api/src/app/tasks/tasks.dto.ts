import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done', 'blocked'])
  status?: 'todo' | 'in_progress' | 'done' | 'blocked';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done', 'blocked'])
  status?: 'todo' | 'in_progress' | 'done' | 'blocked';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
