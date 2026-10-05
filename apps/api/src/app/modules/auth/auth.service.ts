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
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_KEYS } from '../redis/redis.constants';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { GoogleProfileData } from './strategies/google.strategy';
import { setAuthCookies, clearAuthCookies } from './utils/cookie.utils';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

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
          isProfileComplete: true,
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

  /**
   * Progressive Google OAuth user validation & account linking
   */
  async validateGoogleUser(
    profileData: GoogleProfileData,
    res: Response,
    req: Request,
    targetRole?: Role,
  ) {
    let user = await this.prisma.user.findUnique({
      where: { email: profileData.email },
      include: { identities: true },
    });

    let isNewUser = false;

    if (user) {
      // Existing user found by email -> check if Google identity already linked
      const googleIdentity = user.identities.find(
        (id) => id.provider === AuthProvider.GOOGLE,
      );

      if (!googleIdentity) {
        // Progressive Account Linking: Link Google identity to existing local account
        await this.prisma.userIdentity.create({
          data: {
            userId: user.id,
            provider: AuthProvider.GOOGLE,
            providerAccountId: profileData.googleId,
            accessToken: profileData.accessToken,
            refreshToken: profileData.refreshToken,
          },
        });
      } else if (profileData.accessToken) {
        // Update stored Google tokens if refreshed
        await this.prisma.userIdentity.update({
          where: { id: googleIdentity.id },
          data: {
            accessToken: profileData.accessToken,
            refreshToken: profileData.refreshToken || googleIdentity.refreshToken,
          },
        });
      }

      // Update pictureUrl if missing
      if (!user.pictureUrl && profileData.picture) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { pictureUrl: profileData.picture },
          include: { identities: true },
        });
      }
    } else {
      // New user registering via Google OAuth
      isNewUser = true;
      const initialRole = targetRole || Role.PATIENT;

      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: profileData.email,
            fullName: profileData.fullName,
            pictureUrl: profileData.picture,
            role: initialRole,
            isProfileComplete: false, // Progressive onboarding required for missing details
          },
        });

        await tx.userIdentity.create({
          data: {
            userId: newUser.id,
            provider: AuthProvider.GOOGLE,
            providerAccountId: profileData.googleId,
            accessToken: profileData.accessToken,
            refreshToken: profileData.refreshToken,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: newUser.id },
          include: { identities: true },
        });
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken, req);

    setAuthCookies(res, tokens);

    return {
      message: isNewUser
        ? 'Account created successfully with Google. Please complete your profile.'
        : 'Google sign-in successful',
      user: this.sanitizeUser(user),
      isProfileComplete: user.isProfileComplete,
    };
  }

  /**
   * Verify Google ID Token (for Google Identity Services frontend button)
   */
  async verifyGoogleIdToken(
    idToken: string,
    res: Response,
    req: Request,
    targetRole?: Role,
  ) {
    try {
      const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google ID Token payload');
      }

      const profileData: GoogleProfileData = {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        fullName: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
      };

      return this.validateGoogleUser(profileData, res, req, targetRole);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException('Failed to verify Google ID Token: ' + errMessage);
    }
  }

  /**
   * Complete Progressive Profile Onboarding
   */
  async completeProgressiveOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          phone: dto.phone || user.phone,
          role: dto.role || user.role,
          isProfileComplete: true,
        },
      });

      const userRole = dto.role || user.role;

      if (userRole === Role.PATIENT) {
        const existingPatient = await tx.profilePatient.findUnique({ where: { userId } });
        if (!existingPatient) {
          await tx.profilePatient.create({
            data: {
              userId,
              dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : new Date('1990-01-01'),
              gender: dto.gender || 'unspecified',
              bloodGroup: dto.bloodGroup,
              address: dto.address,
            },
          });
        }
      } else if (userRole === Role.DOCTOR) {
        const existingDoctor = await tx.profileDoctor.findUnique({ where: { userId } });
        if (!existingDoctor) {
          await tx.profileDoctor.create({
            data: {
              userId,
              specialization: dto.specialization || 'General Practitioner',
              licenseNumber: dto.licenseNumber || `LIC-${Date.now()}`,
              consultationFee: dto.consultationFee || 100,
            },
          });
        }
      }

      return updated;
    });

    // Invalidate Redis user cache
    await this.redisService.del(REDIS_KEYS.USER_PROFILE(userId));

    return {
      message: 'Profile onboarding completed successfully',
      user: this.sanitizeUser(updatedUser),
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
    if (userId) {
      // Invalidate Redis user cache
      await this.redisService.del(REDIS_KEYS.USER_PROFILE(userId));

      if (refreshToken) {
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
    pictureUrl?: string | null;
    isProfileComplete?: boolean;
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
      pictureUrl: user.pictureUrl || null,
      isProfileComplete: user.isProfileComplete ?? true,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
