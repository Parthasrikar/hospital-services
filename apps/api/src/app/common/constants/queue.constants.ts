export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOB_NAMES = {
  EMAIL: {
    SEND_WELCOME: 'send-welcome-email',
    SEND_OTP: 'send-otp-email',
    SEND_PASSWORD_RESET: 'send-password-reset-email',
    SEND_APPOINTMENT_CONFIRMATION: 'send-appointment-confirmation',
  },
  NOTIFICATIONS: {
    SEND_PUSH: 'send-push-notification',
    SEND_SMS: 'send-sms-notification',
  },
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Initial delay 1s, then 2s, 4s...
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
} as const;
