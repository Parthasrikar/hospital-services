import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class CompleteOnboardingDto {
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsNumber()
  @IsOptional()
  consultationFee?: number;
}
