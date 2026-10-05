import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES } from '../../common/constants/queue.constants';
import { EmailProcessor } from './processors/email.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<number>('REDIS_PORT', 6380)),
          password:
            configService.get<string>('REDIS_PASSWORD', '') || undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUES.EMAIL,
    }),
  ],
  providers: [QueueService, EmailProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
