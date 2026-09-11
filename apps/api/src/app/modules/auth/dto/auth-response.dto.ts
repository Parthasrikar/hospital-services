import { Role } from '@prisma/client';

export class UserProfileDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: Role;
  phone?: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AuthResponseDto {
  message!: string;
  user!: UserProfileDto;
}
