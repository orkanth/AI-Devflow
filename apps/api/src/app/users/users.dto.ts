import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(['Developer', 'Manager', 'Admin'])
  role!: 'Developer' | 'Manager' | 'Admin';
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
  @IsIn(['Developer', 'Manager', 'Admin'])
  role!: 'Developer' | 'Manager' | 'Admin';
}
