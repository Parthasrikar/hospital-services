import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        patient: true,
        doctor: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateData: { fullName?: string; phone?: string }) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateData.fullName && { fullName: updateData.fullName }),
        ...(updateData.phone && { phone: updateData.phone }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}
