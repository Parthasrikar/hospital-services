# Redis Usage Guide for Hospital Services Developers

This guide provides step-by-step instructions and code examples for using Redis in new and existing backend modules within `apps/api`. 

Redis is integrated globally via `RedisModule`, so `RedisService` and `RedisRateLimitGuard` are available across the NestJS application without needing extra imports in sub-modules.

---

## 📋 Quick Reference Table

| Feature | Key Utility / Guard | Common Use Case |
| :--- | :--- | :--- |
| **Rate Limiting** | `@RateLimit()` + `@UseGuards(RedisRateLimitGuard)` | Brute-force protection, search throttling, API quota management |
| **Distributed Lock** | `redisService.acquireLock()` / `releaseLock()` | Preventing double-booking doctor slots, race conditions |
| **Read Caching** | `redisService.get<T>()` / `redisService.set()` | Reducing database read pressure on heavy queries |
| **Cache Invalidation** | `redisService.del()` / `redisService.delByPattern()` | Keeping cache consistent when data is updated/deleted |

---

## 1. Rate Limiting in Controllers

Protect endpoints against abuse, brute-force attacks, or excessive requests by attaching `RedisRateLimitGuard` and the `@RateLimit()` decorator to controllers or individual routes.

### 1.1 Basic Usage on Route

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { RedisRateLimitGuard } from '../redis/redis-rate-limit.guard';
import { RateLimit } from '../redis/rate-limit.decorator';

@Controller('appointments')
export class AppointmentsController {
  
  // Allow maximum 5 appointment creation requests per 60 seconds per IP
  @Post()
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ limit: 5, ttlSeconds: 60 })
  async createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }
}
```

### 1.2 Applying Rate Limiting to an Entire Controller

```typescript
@Controller('search')
@UseGuards(RedisRateLimitGuard)
@RateLimit({ limit: 30, ttlSeconds: 60 }) // Default for all routes in this controller
export class SearchController {
  
  @Get('doctors')
  async searchDoctors() {
    // Uses 30 req/min limit
  }

  @Get('specialties')
  @RateLimit({ limit: 100, ttlSeconds: 60 }) // Override for specific route
  async getSpecialties() {
    // Uses 100 req/min limit
  }
}
```

### 1.3 Recommended Rate Limit Thresholds

- **Authentication (`/login`, `/register`, `/password-reset`)**: `limit: 5`, `ttlSeconds: 60`
- **OTP Generation & Verification**: `limit: 3`, `ttlSeconds: 60`
- **Search & Filter Endpoints**: `limit: 30`, `ttlSeconds: 60`
- **General CRUD Operations**: `limit: 100`, `ttlSeconds: 60`

---

## 2. Distributed Locks (`acquireLock` & `releaseLock`)

In a hospital platform, concurrent operations—such as two patients attempting to book the exact same doctor time slot simultaneously—can result in race conditions and double-bookings. 

Using Redis `acquireLock` ensures that only one request can enter the critical execution block at a time.

### 2.1 Pattern: Acquire -> Execute -> Release in `finally`

```typescript
import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentBookingService {
  private readonly logger = new Logger(AppointmentBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async bookDoctorSlot(patientId: string, doctorId: string, slotTime: string) {
    // Unique lock key for doctor + specific time slot
    const lockKey = `hospital:lock:doctor:${doctorId}:slot:${slotTime}`;
    
    // Acquire a 5-second lock (5000 ms)
    const isLocked = await this.redisService.acquireLock(lockKey, 5000);

    if (!isLocked) {
      throw new ConflictException(
        'This time slot is currently being processed by another user. Please try again in a few seconds.',
      );
    }

    try {
      // 1. Check if slot is already booked in database
      const existingAppointment = await this.prisma.appointment.findFirst({
        where: { doctorId, date: new Date(slotTime), status: { not: 'CANCELLED' } },
      });

      if (existingAppointment) {
        throw new ConflictException('This slot has already been booked.');
      }

      // 2. Perform the booking transaction
      const appointment = await this.prisma.appointment.create({
        data: {
          patientId,
          doctorId,
          date: new Date(slotTime),
          status: 'SCHEDULED',
        },
      });

      // 3. Invalidate cached doctor schedule slots
      await this.redisService.del(`hospital:doctor:${doctorId}:slots`);

      return appointment;

    } finally {
      // ALWAYS release the lock in the finally block!
      await this.redisService.releaseLock(lockKey);
    }
  }
}
```

---

## 3. Read Pressure Reduction (Caching & Cache-Aside)

To prevent hitting MongoDB for frequently accessed, read-heavy queries (e.g., Doctor Profiles, Available Slots, Department Lists), use the **Cache-Aside Pattern**.

### 3.1 Caching a Read Query

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DoctorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getDoctorProfile(doctorId: string) {
    const cacheKey = `hospital:doctor:${doctorId}:profile`;

    // 1. Check Redis Cache
    const cachedProfile = await this.redisService.get<ProfileDoctor>(cacheKey);
    if (cachedProfile) {
      return cachedProfile; // Return directly from Redis
    }


    // 2. Cache Miss - Fetch from Database
    const doctor = await this.prisma.profileDoctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) return null;

    // 3. Store in Redis for 10 minutes (600 seconds)
    await this.redisService.set(cacheKey, doctor, 600);

    return doctor;
  }
}
```

### 3.2 Invalidation on Update/Delete

When data changes, invalidate the cache key immediately so users do not read stale data:

```typescript
async updateDoctorProfile(doctorId: string, dto: UpdateDoctorDto) {
  const updated = await this.prisma.profileDoctor.update({
    where: { id: doctorId },
    data: dto,
  });

  // Invalidate specific doctor cache key
  await this.redisService.del(`hospital:doctor:${doctorId}:profile`);

  // Or invalidate all cached slots for this doctor using pattern matching
  await this.redisService.delByPattern(`hospital:doctor:${doctorId}:*`);

  return updated;
}
```

---

## 🔑 Key Naming Strategy & Central Constants

To prevent key collisions across modules and hardcoding magic strings, use the central constants file located at [`apps/api/src/app/common/constants/redis.constants.ts`](file:///Users/gparthasrikar/Documents/projects/hospital-services/hospital-services/apps/api/src/app/common/constants/redis.constants.ts) (re-exported in `redis.constants.ts`).

### Importing Constants
```typescript
import { REDIS_KEYS, REDIS_TTL, RATE_LIMIT_CONFIGS } from '../redis/redis.constants';
```

### Constant Helpers Available:

```typescript
// 1. Redis Key Generators
REDIS_KEYS.USER_PROFILE(userId)                    // 'hospital:user:<userId>'
REDIS_KEYS.DOCTOR_PROFILE(doctorId)                // 'hospital:doctor:<doctorId>:profile'
REDIS_KEYS.DOCTOR_SLOTS(doctorId)                  // 'hospital:doctor:<doctorId>:slots'
REDIS_KEYS.DOCTOR_ALL_KEYS(doctorId)               // 'hospital:doctor:<doctorId>:*'
REDIS_KEYS.RATE_LIMIT(clientIp, path)              // 'hospital:rate_limit:<ip>:<path>'
REDIS_KEYS.LOCK_DOCTOR_SLOT(doctorId, slotTime)    // 'hospital:lock:doctor:<doctorId>:slot:<slotTime>'
REDIS_KEYS.OTP(identifier)                         // 'hospital:otp:<identifier>'

// 2. TTL Constants (in seconds / ms)
REDIS_TTL.USER_CACHE_SECONDS       // 600 (10 minutes)
REDIS_TTL.DOCTOR_PROFILE_SECONDS   // 600 (10 minutes)
REDIS_TTL.DOCTOR_SLOTS_SECONDS     // 300 (5 minutes)
REDIS_TTL.RATE_LIMIT_WINDOW_SECONDS// 60 (1 minute)
REDIS_TTL.LOCK_DEFAULT_MS          // 5000 (5 seconds)

// 3. Rate Limit Presets
RATE_LIMIT_CONFIGS.AUTH_STRICT     // { limit: 5, ttlSeconds: 60 }
RATE_LIMIT_CONFIGS.SEARCH          // { limit: 30, ttlSeconds: 60 }
RATE_LIMIT_CONFIGS.GLOBAL_DEFAULT  // { limit: 100, ttlSeconds: 60 }
```


---

## 🛠️ RedisService Method Reference Summary

```typescript
// Inject anywhere in your NestJS service:
constructor(private readonly redisService: RedisService) {}

// Read JSON parsed value (returns null if key doesn't exist)
const user = await this.redisService.get<UserType>('hospital:user:123');

// Write JSON value with TTL in seconds
await this.redisService.set('hospital:user:123', userData, 600);

// Delete single or multiple keys
await this.redisService.del('hospital:user:123', 'hospital:user:456');

// Delete keys matching pattern (e.g. all doctor keys)
await this.redisService.delByPattern('hospital:doctor:*');

// Acquire distributed lock (returns boolean)
const locked = await this.redisService.acquireLock('hospital:lock:key', 5000);

// Release distributed lock
await this.redisService.releaseLock('hospital:lock:key');

// Access underlying ioredis client directly for raw commands
const redisRawClient = this.redisService.getClient();
```
