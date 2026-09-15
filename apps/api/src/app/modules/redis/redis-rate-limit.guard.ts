import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { REDIS_KEYS, RATE_LIMIT_CONFIGS } from './redis.constants';
import { RedisService } from './redis.service';

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Default rate limit if no decorator is present: 100 requests per 60 seconds
    const limit = rateLimitOptions?.limit ?? RATE_LIMIT_CONFIGS.GLOBAL_DEFAULT.limit;
    const ttlSeconds =
      rateLimitOptions?.ttlSeconds ?? RATE_LIMIT_CONFIGS.GLOBAL_DEFAULT.ttlSeconds;

    const req = context.switchToHttp().getRequest<Request>();
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const path = req.route?.path || req.originalUrl || req.url;

    const redisKey = REDIS_KEYS.RATE_LIMIT(clientIp, path);


    try {
      const redis = this.redisService.getClient();
      const currentCount = await redis.incr(redisKey);

      if (currentCount === 1) {
        await redis.expire(redisKey, ttlSeconds);
      }

      if (currentCount > limit) {
        const ttl = await redis.ttl(redisKey);
        this.logger.warn(
          `Rate limit exceeded for IP: ${clientIp} on path: ${path} (Count: ${currentCount}/${limit})`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            retryAfterSeconds: ttl > 0 ? ttl : ttlSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      // If Redis fails, log warning and allow request so app doesn't crash
      this.logger.error(`Error checking rate limit in Redis: ${(err as Error).message}`);
      return true;
    }
  }
}
