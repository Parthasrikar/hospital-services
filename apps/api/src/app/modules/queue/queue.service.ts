import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import {
  DEFAULT_JOB_OPTIONS,
  JOB_NAMES,
  QUEUES,
} from '../../common/constants/queue.constants';
import { SendEmailPayload } from './processors/email.processor';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue
  ) {}

  /**
   * Enqueue a welcome email job
   */
  async sendWelcomeEmail(data: SendEmailPayload, options?: JobsOptions) {
    this.logger.log(`Enqueueing welcome email for ${data.to}`);
    return this.emailQueue.add(JOB_NAMES.EMAIL.SEND_WELCOME, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });
  }

  /**
   * Enqueue an OTP email job
   */
  async sendOtpEmail(data: SendEmailPayload, options?: JobsOptions) {
    this.logger.log(`Enqueueing OTP email for ${data.to}`);
    return this.emailQueue.add(JOB_NAMES.EMAIL.SEND_OTP, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });
  }

  /**
   * Enqueue a password reset email job
   */
  async sendPasswordResetEmail(
    data: SendEmailPayload,
    options?: JobsOptions
  ) {
    this.logger.log(`Enqueueing password reset email for ${data.to}`);
    return this.emailQueue.add(
      JOB_NAMES.EMAIL.SEND_PASSWORD_RESET,
      data,
      { ...DEFAULT_JOB_OPTIONS, ...options }
    );
  }

  /**
   * Enqueue an appointment confirmation email job
   */
  async sendAppointmentConfirmationEmail(
    data: SendEmailPayload,
    options?: JobsOptions
  ) {
    this.logger.log(
      `Enqueueing appointment confirmation email for ${data.to}`
    );
    return this.emailQueue.add(
      JOB_NAMES.EMAIL.SEND_APPOINTMENT_CONFIRMATION,
      data,
      { ...DEFAULT_JOB_OPTIONS, ...options }
    );
  }

  /**
   * Generic method to add custom jobs to the Email Queue
   */
  async addEmailJob(
    jobName: string,
    data: SendEmailPayload,
    options?: JobsOptions
  ) {
    return this.emailQueue.add(jobName, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });
  }

  /**
   * Get queue health statistics
   */
  async getEmailQueueHealth() {
    const [active, waiting, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getActiveCount(),
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return {
      name: QUEUES.EMAIL,
      counts: {
        active,
        waiting,
        completed,
        failed,
        delayed,
      },
    };
  }
}
