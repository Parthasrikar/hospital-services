import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_NAMES, QUEUES } from '../../../common/constants/queue.constants';

export interface SendEmailPayload {
  to: string;
  subject: string;
  template?: string;
  context?: Record<string, unknown>;
  createdAt?: Date;
  
}

@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<SendEmailPayload, void, string>): Promise<void> {
    this.logger.log(`Processing email job: ${job.name} [ID: ${job.id}]`);

    switch (job.name) {
      case JOB_NAMES.EMAIL.SEND_WELCOME:
        await this.handleSendWelcomeEmail(job.data);
        break;
      case JOB_NAMES.EMAIL.SEND_OTP:
        await this.handleSendOtpEmail(job.data);
        break;
      case JOB_NAMES.EMAIL.SEND_PASSWORD_RESET:
        await this.handleSendPasswordResetEmail(job.data);
        break;
      case JOB_NAMES.EMAIL.SEND_APPOINTMENT_CONFIRMATION:
        await this.handleSendAppointmentConfirmationEmail(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendWelcomeEmail(data: SendEmailPayload): Promise<void> {
    this.logger.log(`Sending welcome email to ${data.to}`);
    // Place email provider integration (e.g. Nodemailer, Resend, SendGrid) here
  }

  private async handleSendOtpEmail(data: SendEmailPayload): Promise<void> {
    this.logger.log(`Sending OTP email to ${data.to}`);
    // Place email provider integration here
  }

  private async handleSendPasswordResetEmail(data: SendEmailPayload): Promise<void> {
    this.logger.log(`Sending password reset email to ${data.to}`);
    // Place email provider integration here
  }

  private async handleSendAppointmentConfirmationEmail(data: SendEmailPayload): Promise<void> {
    this.logger.log(`Sending appointment confirmation email to ${data.to}`);
    // Place email provider integration here
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} of type ${job.name} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job?.id} of type ${job?.name} failed: ${error.message}`,
      error.stack
    );
  }
}
