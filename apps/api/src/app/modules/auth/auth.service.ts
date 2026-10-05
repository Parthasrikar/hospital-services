import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { setAuthCookies, clearAuthCookies } from './utils/cookie.utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, res: Response, req: Request) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          role: dto.role || Role.PATIENT,
          phone: dto.phone,
        },
      });

      await tx.userIdentity.create({
        data: {
          userId: newUser.id,
          provider: AuthProvider.LOCAL,
          passwordHash,
        },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken, req);

    setAuthCookies(res, tokens);

    return {
      message: 'User registered successfully',
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto, res: Response, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        identities: {
          where: { provider: AuthProvider.LOCAL },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const localIdentity = user.identities[0];
    if (!localIdentity || !localIdentity.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, localIdentity.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken, req);

    setAuthCookies(res, tokens);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
    };
  }

  async refreshTokens(userId: string, refreshToken: string, res: Response, req: Request) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedSession = null;
    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.hashedRefreshToken);
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Invalid or expired refresh session');
    }

    // Delete used session (token rotation)
    await this.prisma.userSession.delete({
      where: { id: matchedSession.id },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      clearAuthCookies(res);
      throw new UnauthorizedException('User account inactive');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken, req);

    setAuthCookies(res, tokens);

    return {
      message: 'Tokens refreshed successfully',
      user: this.sanitizeUser(user),
    };
  }

  async logout(userId: string, refreshToken: string | undefined, res: Response) {
    if (userId && refreshToken) {
      const sessions = await this.prisma.userSession.findMany({
        where: { userId },
      });

      for (const session of sessions) {
        const isMatch = await bcrypt.compare(refreshToken, session.hashedRefreshToken);
        if (isMatch) {
          await this.prisma.userSession.delete({ where: { id: session.id } });
          break;
        }
      }
    }

    clearAuthCookies(res);

    return {
      message: 'Logged out successfully',
    };
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload = { sub: userId, email, role };

    const accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev_access_secret_key_change_in_production',
    );
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'dev_refresh_secret_key_change_in_production',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, refreshToken: string, req: Request) {
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.userSession.create({
      data: {
        userId,
        hashedRefreshToken,
        userAgent: req?.headers?.['user-agent'] || 'Unknown',
        ipAddress: req?.ip || 'Unknown',
        expiresAt,
      },
    });
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    phone?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
