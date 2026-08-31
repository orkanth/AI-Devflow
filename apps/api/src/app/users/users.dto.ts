import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(['engineer', 'pm', 'admin'])
  role!: 'engineer' | 'pm' | 'admin';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['engineer', 'pm', 'admin'])
  role?: 'engineer' | 'pm' | 'admin';
}
