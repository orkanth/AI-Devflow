import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class IngestKnowledgeDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(10)
  content!: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
