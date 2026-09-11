# Comprehensive Authentication Architecture & Lifecycle Documentation

This document provides an exhaustive reference for the authentication system implemented in `apps/api`. It covers the design philosophy, database schema, security mechanisms, file responsibilities, end-to-end lifecycle flows, Mermaid sequence diagrams, and frontend integration.

---

## 1. Architectural Principles & Security Design

### A. HTTP-Only Cookie Storage (XSS Protection)
Storing JWTs in `localStorage` or `sessionStorage` exposes applications to **Cross-Site Scripting (XSS)** attacks, where malicious scripts can read tokens and impersonate users. 

This architecture enforces **HTTP-Only, SameSite, Path-Scoped Cookies**:
- **`access_token` Cookie**:
  - `HttpOnly: true` (Inaccessible to JavaScript)
  - `SameSite: 'lax'` (CSRF mitigation)
  - `Path: '/'` (Available for all API requests)
  - `Max-Age: 15 minutes` (Short-lived token window)
- **`refresh_token` Cookie**:
  - `HttpOnly: true`
  - `SameSite: 'lax'`
  - `Path: '/api/auth/refresh'` (Restricted scope; sent *only* when hitting the refresh endpoint)
  - `Max-Age: 7 days` (Long-lived session window)

### B. Decoupled Base User & Auth Strategy Discriminator (`UserIdentity`)
Rather than storing password hashes or OAuth provider fields directly on the core `User` model, entity management is decoupled from authentication mechanisms:
- **`User` Entity**: Core identity (`id`, `email`, `fullName`, `role`, `phone`, `isActive`).
- **`UserIdentity` Entity**: Auth provider bindings (`userId`, `provider` enum (`LOCAL`, `GOOGLE`), `providerAccountId`, `passwordHash`).
- **Benefits**:
  1. Users can register with Email/Password (`provider: LOCAL`) and later link their Google account (`provider: GOOGLE`) to the exact same base user.
  2. Adding new OAuth providers requires zero schema changes to core user tables.

### C. Multi-Device Session Management & Token Rotation (`UserSession`)
Refresh tokens are hashed using `bcryptjs` and stored in the `UserSession` MongoDB table:
- **Token Rotation**: Every time a refresh token is used at `/api/auth/refresh`, the old session is deleted and a fresh session is issued with a new refresh token.
- **Session Revocation**: Logging out deletes the session from the database, instantly invalidating the refresh token even if someone possesses the raw cookie.
- **Multi-Device Support**: Users can be logged into multiple browsers/devices simultaneously without invalidating each other's sessions.

---

## 2. Database Schema (Prisma & MongoDB)

```mermaid
erDiagram
    USER ||--o{ USER_IDENTITY : "has identities"
    USER ||--o{ USER_SESSION : "has active sessions"
    USER ||--o| PROFILE_PATIENT : "has patient profile"
    USER ||--o| PROFILE_DOCTOR : "has doctor profile"

    USER {
        string id PK "_id"
        string email UK
        string fullName
        Role role
        string phone
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    USER_IDENTITY {
        string id PK "_id"
        string userId FK
        AuthProvider provider "LOCAL | GOOGLE"
        string providerAccountId
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }

    USER_SESSION {
        string id PK "_id"
        string userId FK
        string hashedRefreshToken
        string userAgent
        string ipAddress
        datetime expiresAt
        datetime createdAt
    }
```

---

## 3. Directory Structure & File Map

```
apps/api/src/app/
├── modules/
│   ├── auth/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts    # Custom parameter decorator to extract req.user
│   │   │   └── roles.decorator.ts           # Metadata decorator to specify required roles
│   │   ├── dto/
│   │   │   ├── auth-response.dto.ts         # UserProfileDto and AuthResponseDto
│   │   │   ├── login.dto.ts                 # Login validation schema
│   │   │   └── register.dto.ts              # Registration validation schema
│   │   ├── guards/
│   │   │   ├── jwt-access.guard.ts          # Protects routes requiring valid access token
│   │   │   ├── jwt-refresh.guard.ts         # Protects refresh route requiring valid refresh token
│   │   │   └── roles.guard.ts               # Enforces Role-Based Access Control (RBAC)
│   │   ├── strategies/
│   │   │   ├── google.strategy.ts           # Prepared Google OAuth 2.0 configuration stub
│   │   │   ├── jwt-access.strategy.ts       # Extracts & validates access_token cookie
│   │   │   └── jwt-refresh.strategy.ts      # Extracts & validates refresh_token cookie
│   │   ├── utils/
│   │   │   └── cookie.utils.ts              # setAuthCookies() & clearAuthCookies() helpers
│   │   ├── auth.controller.ts               # Auth REST endpoints
│   │   ├── auth.module.ts                   # Auth feature module configuration
│   │   └── auth.service.ts                  # Auth business logic (hashing, sessions, JWTs)
│   ├── users/
│   │   ├── users.controller.ts              # Profile retrieval and update endpoints
│   │   ├── users.module.ts                 # Users feature module configuration
│   │   └── users.service.ts                 # User profile query service
│   └── prisma/
│       ├── prisma.module.ts                 # Database access module
│       └── prisma.service.ts                # Prisma singleton client service
└── app.module.ts                        # Main application root module
```

---

## 4. End-to-End Flow Lifecycles & Sequence Diagrams

### Flow 1: Registration (`POST /api/auth/register`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    Client->>Controller: POST /api/auth/register (RegisterDto)
    Note over Controller: NestJS ValidationPipe validates email, password, fullName
    Controller->>Service: register(dto, res, req)
    Service->>DB: findUnique({ where: { email } })
    alt Email Exists
        DB-->>Service: Existing User Record
        Service-->>Client: 400 Bad Request ("User with this email already exists")
    else Email Available
        Service->>Service: Hash password with bcryptjs (salt rounds = 10)
        Service->>DB: $transaction(Create User + Create UserIdentity[LOCAL])
        DB-->>Service: New User Entity
        Service->>Service: Generate Access Token (15m) & Refresh Token (7d)
        Service->>Service: Hash Refresh Token with bcryptjs
        Service->>DB: create UserSession(userId, hashedRefreshToken, userAgent, ip)
        Service->>Cookie: setAuthCookies(res, tokens)
        Note over Cookie: Sets HttpOnly access_token & refresh_token cookies
        Service-->>Controller: Sanitized User Profile
        Controller-->>Client: 201 Created { message, user }
    end
```

---

### Flow 2: Login (`POST /api/auth/login`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    Client->>Controller: POST /api/auth/login (LoginDto)
    Note over Controller: ValidationPipe checks email & password presence
    Controller->>Service: login(dto, res, req)
    Service->>DB: findUnique({ email }, include identities[LOCAL])
    alt User Not Found / Inactive / Password Mismatch
        Service-->>Client: 401 Unauthorized ("Invalid credentials")
    else Credentials Valid
        Service->>Service: Generate Access Token & Refresh Token
        Service->>Service: Hash Refresh Token with bcryptjs
        Service->>DB: create UserSession(userId, hashedRefreshToken, userAgent, ip)
        Service->>Cookie: setAuthCookies(res, tokens)
        Service-->>Controller: Sanitized User Profile
        Controller-->>Client: 200 OK { message, user }
    end
```

---

### Flow 3: Accessing Protected Endpoints (`GET /api/auth/me`, `GET /api/users/profile`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Interceptor as Angular AuthInterceptor
    participant Guard as JwtAccessGuard
    participant Strategy as JwtAccessStrategy
    participant Controller as AuthController/UsersController
    participant DB as Prisma (MongoDB)

    Client->>Interceptor: Request GET /api/auth/me
    Note over Interceptor: Clones request with withCredentials: true
    Interceptor->>Guard: HTTP Request (with access_token Cookie)
    Guard->>Strategy: Extract req.cookies.access_token
    Strategy->>Strategy: Verify JWT signature & expiration
    Strategy->>DB: findUnique({ id: payload.sub })
    alt User Valid & Active
        DB-->>Strategy: User Entity
        Strategy-->>Guard: Attach user to req.user
        Guard-->>Controller: Allow execution
        Controller-->>Client: 200 OK { user }
    else Invalid Token or User Inactive
        Strategy-->>Client: 401 Unauthorized
    end
```

---

### Flow 4: Token Refresh & Rotation (`POST /api/auth/refresh`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Guard as JwtRefreshGuard
    participant Strategy as JwtRefreshStrategy
    participant Service as AuthService
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    Client->>Guard: POST /api/auth/refresh (with refresh_token Cookie)
    Note over Guard: Path scoped to /api/auth/refresh
    Guard->>Strategy: Extract req.cookies.refresh_token
    Strategy->>Strategy: Verify JWT signature & expiration
    Strategy-->>Service: refreshTokens(userId, refreshToken, res, req)
    Service->>DB: findMany UserSessions for userId
    Service->>Service: bcrypt.compare(refreshToken, session.hashedRefreshToken)
    alt Session Match Found
        Service->>DB: delete UserSession (Token Rotation)
        Service->>DB: findUnique User
        Service->>Service: Generate new token pair
        Service->>DB: create new UserSession
        Service->>Cookie: setAuthCookies(res, newTokens)
        Service-->>Client: 200 OK { message, user }
    else No Session Match / Expired
        Service->>Cookie: clearAuthCookies(res)
        Service-->>Client: 401 Unauthorized ("Invalid or expired refresh session")
    end
```

---

### Flow 5: Logout (`POST /api/auth/logout`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    Client->>Controller: POST /api/auth/logout (JwtAccessGuard)
    Controller->>Service: logout(userId, refreshToken, res)
    Service->>DB: findMany UserSessions for userId
    Service->>Service: Find matching session hash & delete from DB
    Service->>Cookie: clearAuthCookies(res)
    Note over Cookie: Clears access_token & refresh_token cookies (Max-Age=0)
    Service-->>Client: 200 OK { message: "Logged out successfully" }
```

---

## 5. Frontend Angular Integration (`hospital-admin` & `patient-web`)

Because tokens are managed via HTTP-Only cookies, frontends do **not** read or store raw token strings in `localStorage`.

### Angular `authInterceptor` Configuration:
[`apps/hospital-admin/src/app/core/interceptors/auth.interceptor.ts`](file:///Users/gparthasrikar/Documents/projects/hospital-services/hospital-services/apps/hospital-admin/src/app/core/interceptors/auth.interceptor.ts)
```typescript
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Always include credentials (HTTP-Only Cookies) on outgoing API requests
  const authReq = req.clone({
    withCredentials: true,
  });

  return next(authReq);
};
```

### NestJS CORS Configuration:
[`apps/api/src/main.ts`](file:///Users/gparthasrikar/Documents/projects/hospital-services/hospital-services/apps/api/src/main.ts)
```typescript
app.enableCors({
  origin: [
    'http://localhost:4200', // patient-web
    'http://localhost:4201', // hospital-admin
    'http://localhost:3000',
  ],
  credentials: true, // Required for cross-site cookie transmission
});
```

---

## 6. Future Extension Roadmap: Google OAuth 2.0 Integration

To activate Google OAuth 2.0 in the future:

1. **Install Strategy Package**:
   ```bash
   pnpm add passport-google-oauth20 && pnpm add -D @types/passport-google-oauth20
   ```
2. **Environment Variables**:
   Update `.env` with actual credentials from Google Cloud Console:
   ```env
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
   ```
3. **Activate `GoogleStrategy`**:
   Extend Passport `GoogleStrategy` in `google.strategy.ts`. When a user authenticates via Google:
   - Extract `profile.id` and `profile.emails[0].value`.
   - Query `UserIdentity` where `provider = GOOGLE` and `providerAccountId = profile.id`.
   - If not found, create base `User` record and link `UserIdentity(provider: GOOGLE, providerAccountId: profile.id)`.
   - Issue tokens, create `UserSession`, and attach HTTP-Only cookies.
