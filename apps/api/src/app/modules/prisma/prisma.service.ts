import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Singleton Client Optimization:
    // Uses existing client on globalThis during dev hot-reloads to prevent connection leaks
    super();

    if (process.env['NODE_ENV'] !== 'production') {
      if (!globalThis.prisma) {
        globalThis.prisma = this;
      }
    }
  }

  async onModuleInit() {
    this.logger.log('Connecting to MongoDB via Prisma Singleton Client...');
    await this.$connect();
    this.logger.log('Successfully connected to MongoDB.');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Prisma Client...');
    await this.$disconnect();
  }
}
