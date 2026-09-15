import { Test, TestingModule } from '@nestjs/testing';
import { QUEUES } from '../../common/constants/queue.constants';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: {
    add: jest.Mock;
    getActiveCount: jest.Mock;
    getWaitingCount: jest.Mock;
    getCompletedCount: jest.Mock;
    getFailedCount: jest.Mock;
    getDelayedCount: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '1' }),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
      getDelayedCount: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: `BullQueue_${QUEUES.EMAIL}`,
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add a welcome email job to queue', async () => {
    const payload = { to: 'test@example.com', subject: 'Welcome!' };
    const res = await service.sendWelcomeEmail(payload);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-welcome-email',
      payload,
      expect.objectContaining({ attempts: 3 })
    );
    expect(res).toEqual({ id: '1' });
  });

  it('should return email queue health metrics', async () => {
    const health = await service.getEmailQueueHealth();
    expect(health).toEqual({
      name: 'email',
      counts: {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
    });
  });
});
