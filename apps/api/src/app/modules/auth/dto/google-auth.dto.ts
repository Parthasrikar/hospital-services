import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class GoogleTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
