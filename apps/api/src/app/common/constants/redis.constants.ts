export const REDIS_KEY_PREFIX = 'hospital';

/**
 * Standard Redis Key Generators
 */
export const REDIS_KEYS = {
  USER_PROFILE: (userId: string) => `${REDIS_KEY_PREFIX}:user:${userId}`,
  DOCTOR_PROFILE: (doctorId: string) => `${REDIS_KEY_PREFIX}:doctor:${doctorId}:profile`,
  DOCTOR_SLOTS: (doctorId: string) => `${REDIS_KEY_PREFIX}:doctor:${doctorId}:slots`,
  DOCTOR_ALL_KEYS: (doctorId: string) => `${REDIS_KEY_PREFIX}:doctor:${doctorId}:*`,
  RATE_LIMIT: (clientIp: string, path: string) =>
    `${REDIS_KEY_PREFIX}:rate_limit:${clientIp}:${path}`,
  LOCK_DOCTOR_SLOT: (doctorId: string, slotTime: string) =>
    `${REDIS_KEY_PREFIX}:lock:doctor:${doctorId}:slot:${slotTime}`,
  OTP: (identifier: string) => `${REDIS_KEY_PREFIX}:otp:${identifier}`,
} as const;

/**
 * Default TTL Configurations
 */
export const REDIS_TTL = {
  USER_CACHE_SECONDS: 600, // 10 minutes
  DOCTOR_PROFILE_SECONDS: 600, // 10 minutes
  DOCTOR_SLOTS_SECONDS: 300, // 5 minutes
  RATE_LIMIT_WINDOW_SECONDS: 60, // 1 minute
  LOCK_DEFAULT_MS: 5000, // 5 seconds
} as const;

/**
 * Common Rate Limit Threshold Configs
 */
export const RATE_LIMIT_CONFIGS = {
  AUTH_STRICT: { limit: 5, ttlSeconds: 60 },
  SEARCH: { limit: 30, ttlSeconds: 60 },
  GLOBAL_DEFAULT: { limit: 100, ttlSeconds: 60 },
} as const;
