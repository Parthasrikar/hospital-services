import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6380));
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log(`🚀 Redis connection established on ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ Redis connection error: ${err.message}`, err.stack);
    });

    this.client.connect().catch((err) => {
      this.logger.error(`❌ Could not connect to Redis: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed.');
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.error(`Failed to get key ${key} from Redis`, err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      this.logger.error(`Failed to set key ${key} in Redis`, err);
    }
  }


  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.error(`Failed to delete keys from Redis`, err);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      this.logger.error(`Failed to delete keys by pattern ${pattern}`, err);
    }
  }

  /**
   * Distributed Lock using SET key value NX PX ttlMs
   */
  async acquireLock(lockKey: string, ttlMs = 5000): Promise<boolean> {
    try {
      const result = await this.client.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.error(`Failed to acquire lock ${lockKey}`, err);
      return false;
    }
  }

  async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.client.del(lockKey);
    } catch (err) {
      this.logger.error(`Failed to release lock ${lockKey}`, err);
    }
  }
}
