import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(2)
  message!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
