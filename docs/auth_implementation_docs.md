# Comprehensive Authentication Architecture & Lifecycle Documentation

This document provides an exhaustive reference for the authentication system implemented in `apps/api` and consumed across `@hospital-services/api-client`, `apps/hospital-admin`, and `apps/patient-web`. It covers security architecture, database schema, Progressive Google OAuth 2.0 integration, account linking, progressive profile onboarding, sequence diagrams, and frontend integration.

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
- **`User` Entity**: Core identity (`id`, `email`, `fullName`, `role`, `phone`, `pictureUrl`, `isProfileComplete`, `isActive`).
- **`UserIdentity` Entity**: Auth provider bindings (`userId`, `provider` enum (`LOCAL`, `GOOGLE`), `providerAccountId`, `passwordHash`, `accessToken`, `refreshToken`).
- **Benefits**:
  1. **Progressive Account Linking**: Users can register with Email/Password (`provider: LOCAL`) and later sign in with Google (`provider: GOOGLE`) using the same email. The system automatically links the Google identity to the existing base user.
  2. **Progressive OAuth Scope Storage**: OAuth access tokens and refresh tokens received during Google consent are stored on `UserIdentity`, allowing backend workers (e.g., BullMQ) to perform feature-level integrations (such as Google Calendar sync) on behalf of the user.

### C. Progressive OAuth & Profile Onboarding
- **Low-Friction Initial Sign In**: Initial Google OAuth requests standard identity scopes (`openid`, `email`, `profile`).
- **Progressive Onboarding**: If a user logs in via Google for the first time and lacks required role/phone details, `isProfileComplete` is set to `false`. The frontend prompts the user with a progressive onboarding step (`/auth/onboarding`) to complete profile metadata without blocking initial authentication.
- **Dual Flow Support**: Supports both Server-Side Passport OAuth 2.0 (`/api/auth/google`) and Client-Side Google Identity Services (GIS) ID Token verification (`/api/auth/google/token`).

### D. Multi-Device Session Management & Token Rotation (`UserSession`)
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
        Role role "ADMIN | DOCTOR | PATIENT | NURSE | STAFF"
        string phone
        string pictureUrl
        boolean isProfileComplete
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
        string accessToken
        string refreshToken
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
│   │   │   ├── current-user.decorator.ts    # Parameter decorator to extract req.user
│   │   │   └── roles.decorator.ts           # Metadata decorator to specify required roles
│   │   ├── dto/
│   │   │   ├── auth-response.dto.ts         # UserProfileDto and AuthResponseDto
│   │   │   ├── complete-onboarding.dto.ts   # Post-OAuth profile completion schema
│   │   │   ├── google-auth.dto.ts           # Google ID Token schema
│   │   │   ├── login.dto.ts                 # Login validation schema
│   │   │   └── register.dto.ts              # Registration validation schema
│   │   ├── guards/
│   │   │   ├── google-auth.guard.ts         # Passport Google Strategy route guard
│   │   │   ├── jwt-access.guard.ts          # Protects routes requiring valid access token
│   │   │   ├── jwt-refresh.guard.ts         # Protects refresh route requiring valid refresh token
│   │   │   └── roles.guard.ts               # Enforces Role-Based Access Control (RBAC)
│   │   ├── strategies/
│   │   │   ├── google.strategy.ts           # Passport Google OAuth 2.0 Strategy
│   │   │   ├── jwt-access.strategy.ts       # Extracts & validates access_token cookie
│   │   │   └── jwt-refresh.strategy.ts      # Extracts & validates refresh_token cookie
│   │   ├── utils/
│   │   │   └── cookie.utils.ts              # setAuthCookies() & clearAuthCookies() helpers
│   │   ├── auth.controller.ts               # Auth REST endpoints (Google OAuth, login, register, refresh)
│   │   ├── auth.module.ts                   # Auth feature module configuration
│   │   └── auth.service.ts                  # Auth business logic (Google validation, account linking, JWTs)
│   ├── users/
│   │   ├── users.controller.ts              # Profile retrieval and update endpoints
│   │   ├── users.module.ts                  # Users feature module configuration
│   │   └── users.service.ts                 # User profile query service
│   └── prisma/
│       ├── prisma.module.ts                 # Database access module
│       └── prisma.service.ts                # Prisma singleton client service
└── app.module.ts                            # Main application root module
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

### Flow 2: Progressive Google OAuth Login & Account Linking (`GET /api/auth/google/callback`)

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Controller as AuthController
    participant Guard as GoogleAuthGuard
    participant Strategy as GoogleStrategy
    participant Service as AuthService
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    User->>Controller: GET /api/auth/google
    Controller->>Guard: Redirects to Google OAuth 2.0 Consent Screen
    User->>Controller: Redirects to GET /api/auth/google/callback?code=...
    Guard->>Strategy: Exchange authorization code for Google Profile & OAuth Tokens
    Strategy-->>Controller: GoogleProfileData (googleId, email, fullName, picture, accessToken)
    Controller->>Service: validateGoogleUser(profileData, res, req)
    Service->>DB: findUnique User by email
    alt User Exists (Local or Google)
        alt Google Identity Missing
            Service->>DB: create UserIdentity(provider: GOOGLE, providerAccountId)
            Note over Service: Progressive Account Linking Complete
        end
    else New User Registration
        Service->>DB: $transaction(Create User[isProfileComplete=false] + UserIdentity[GOOGLE])
    end
    Service->>Service: Generate JWT Tokens & Create UserSession
    Service->>Cookie: setAuthCookies(res, tokens)
    alt isProfileComplete == false
        Controller-->>User: 302 Redirect to /auth/onboarding
    else Profile Complete
        Controller-->>User: 302 Redirect to /dashboard
    end
```

---

### Flow 3: Client-Side Google ID Token Verification (`POST /api/auth/google/token`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client (GSI Button)
    participant Controller as AuthController
    participant Service as AuthService
    participant Google as Google Auth Library (OAuth2Client)
    participant DB as Prisma (MongoDB)
    participant Cookie as CookieUtils

    Client->>Controller: POST /api/auth/google/token (idToken)
    Controller->>Service: verifyGoogleIdToken(idToken, res, req)
    Service->>Google: verifyIdToken({ idToken, audience })
    Google-->>Service: Validated Payload (sub, email, name, picture)
    Service->>Service: validateGoogleUser(profileData, res, req)
    Service->>DB: Find / Link Account / Create User
    Service->>Cookie: setAuthCookies(res, tokens)
    Service-->>Controller: Sanitized User Profile & isProfileComplete flag
    Controller-->>Client: 200 OK { message, user, isProfileComplete }
```

---

### Flow 4: Progressive Profile Onboarding (`PATCH /api/auth/progressive-onboarding`)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Angular Client
    participant Controller as AuthController
    participant Guard as JwtAccessGuard
    participant Service as AuthService
    participant DB as Prisma (MongoDB)

    Client->>Controller: PATCH /api/auth/progressive-onboarding (CompleteOnboardingDto)
    Controller->>Guard: Validate access_token cookie
    Controller->>Service: completeProgressiveOnboarding(userId, dto)
    Service->>DB: $transaction(Update User[isProfileComplete=true, phone, role] + Create ProfilePatient/Doctor)
    DB-->>Service: Updated User Entity
    Service->>Service: Invalidate Redis User Profile Cache
    Service-->>Controller: Sanitized User Profile
    Controller-->>Client: 200 OK { message, user }
```

---

### Flow 5: Token Refresh & Rotation (`POST /api/auth/refresh`)

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

## 5. Frontend Angular Integration (`hospital-admin` & `patient-web`)

All frontend applications consume `AuthApiService` directly from `@hospital-services/api-client`.

### Auth API Service Methods (`AuthApiService`):
- `login(credentials: LoginCredentials)`: Standard email/password login.
- `register(credentials: RegisterCredentials)`: Standard email/password registration.
- `loginWithGoogleRedirect()`: Initiates browser redirect to `/api/auth/google`.
- `loginWithGoogleToken(credentials: GoogleTokenCredentials)`: Verifies client-side Google GSI ID Token.
- `completeOnboarding(credentials: CompleteOnboardingCredentials)`: Sends profile onboarding metadata.
- `fetchCurrentUser()`: Auto-restores user session on page load via HTTP-Only cookie.
- `logout()`: Clears HTTP-Only cookies and resets Angular user signals (`currentUser`, `isAuthenticated`, `isProfileComplete`).

### Angular `authInterceptor` Configuration (`withCredentials: true`):
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
