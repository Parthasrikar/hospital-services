import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_KEYS, REDIS_TTL } from '../../redis/redis.constants';
import { RedisService } from '../../redis/redis.service';
import { ACCESS_TOKEN_COOKIE } from '../utils/cookie.utils';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface CachedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.[ACCESS_TOKEN_COOKIE] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev_access_secret_key_change_in_production',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = REDIS_KEYS.USER_PROFILE(payload.sub);
    
    // Check Redis cache first (Cache-Aside Pattern)
    const cachedUser = await this.redisService.get<CachedUser>(cacheKey);
    if (cachedUser) {
      if (!cachedUser.isActive) {
        throw new UnauthorizedException('User account is invalid or inactive');
      }
      return cachedUser;
    }

    // Cache Miss - Query MongoDB
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive');
    }

    // Cache user in Redis for 10 minutes (600 seconds)
    const ttl = Number(
      this.configService.get<number>('REDIS_TTL', REDIS_TTL.USER_CACHE_SECONDS),
    );
    await this.redisService.set(cacheKey, user, ttl);

    return user;
  }
}


