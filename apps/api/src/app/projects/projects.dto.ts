import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  description!: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsIn(['planning', 'active', 'on_hold', 'completed', 'archived'])
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['planning', 'active', 'on_hold', 'completed', 'archived'])
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';
}
