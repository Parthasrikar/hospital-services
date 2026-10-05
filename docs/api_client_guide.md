# Shared API Client Architecture & Usage Guidelines (`@hospital-services/api-client`)

This document defines the architecture, file naming conventions, model interface rules, and step-by-step instructions for consuming and extending the shared frontend API client library (`libs/api-client`) across `hospital-admin`, `patient-web`, and future frontend applications.

---

## 1. Core Architecture & Philosophy

- **Package Alias**: `@hospital-services/api-client`
- **Location**: `libs/api-client/`
- **Core Engine**: Axios + RxJS Observables / Promises with `withCredentials: true` enabled.
- **Key Features**:
  1. **HTTP-Only Cookie Security**: Authentication cookies (`access_token`, `refresh_token`) are attached automatically by the browser on all HTTP requests.
  2. **Automatic 401 Token Rotation & Retry**: If an `access_token` expires, `axios-client.ts` intercepts the 401 response, calls `/api/auth/refresh`, updates the cookies, and transparently retries the failed requests without dropping user UI state.
  3. **Angular Signals Support**: Feature API services export reactive Angular `signal` and `computed` state (e.g. `currentUser`, `isAuthenticated`, `userRole`).

---

## 2. Directory Structure & Naming Conventions

```
libs/api-client/
├── src/
│   ├── lib/
│   │   ├── models/                      # Centralized TypeScript models and interfaces
│   │   │   ├── auth.model.ts
│   │   │   ├── [modulename].model.ts    # e.g., appointment.model.ts, doctor.model.ts
│   │   │   └── index.ts                 # Barrel export for all data models
│   │   ├── axios-client.ts              # Core Axios engine (Base URL, credentials, 401 queue)
│   │   ├── api-client.service.ts         # Injectable HTTP client service wrapper
│   │   ├── auth.api.ts                  # Auth feature API service (AuthApiService)
│   │   └── [modulename].api.ts          # Feature API services (e.g., appointments.api.ts)
│   └── index.ts                         # Public package barrel export
```

### Mandatory Naming Rules

| Asset Type | File Path Pattern | Class / Interface Naming Pattern | Example |
| :--- | :--- | :--- | :--- |
| **Data Model** | `libs/api-client/src/lib/models/<modulename>.model.ts` | `<EntityName>`, `<Action>Dto` | `SharedUser`, `CreateAppointmentDto` |
| **Feature API** | `libs/api-client/src/lib/<modulename>.api.ts` | `<ModuleName>ApiService` | `AuthApiService`, `AppointmentsApiService` |
| **Model Export**| Exported in `libs/api-client/src/lib/models/index.ts` | `export * from './<modulename>.model';` | `export * from './appointment.model';` |
| **Library Export**| Exported in `libs/api-client/src/index.ts` | `export * from './lib/<modulename>.api';` | `export * from './lib/appointments.api';` |

---

## 3. Step-by-Step Guide: Adding a New Feature Module (e.g., `Appointments`)

Follow these 4 steps whenever adding a new feature area to `@hospital-services/api-client`:

### Step 1: Create Data Model File
Create `libs/api-client/src/lib/models/appointment.model.ts`:

```typescript
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDto {
  doctorId: string;
  date: string;
  notes?: string;
}

export interface UpdateAppointmentDto {
  status?: AppointmentStatus;
  notes?: string;
}
```

---

### Step 2: Export Model in Barrel
Update `libs/api-client/src/lib/models/index.ts`:

```typescript
export * from './auth.model';
export * from './appointment.model';
```

---

### Step 3: Create Feature API Service (`<modulename>.api.ts`)
Create `libs/api-client/src/lib/appointments.api.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Appointment, CreateAppointmentDto, UpdateAppointmentDto } from './models';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsApiService {
  private readonly api = inject(ApiClientService);

  /**
   * Fetches all appointments
   */
  getAppointments(): Observable<Appointment[]> {
    return this.api.get<Appointment[]>('/appointments');
  }

  /**
   * Fetches appointment by ID
   */
  getAppointmentById(id: string): Observable<Appointment> {
    return this.api.get<Appointment>(`/appointments/${id}`);
  }

  /**
   * Creates a new appointment
   */
  createAppointment(dto: CreateAppointmentDto): Observable<Appointment> {
    return this.api.post<Appointment>('/appointments', dto);
  }

  /**
   * Updates an existing appointment
   */
  updateAppointment(id: string, dto: UpdateAppointmentDto): Observable<Appointment> {
    return this.api.put<Appointment>(`/appointments/${id}`, dto);
  }

  /**
   * Cancels an appointment
   */
  cancelAppointment(id: string): Observable<{ message: string }> {
    return this.api.patch<{ message: string }>(`/appointments/${id}/cancel`);
  }
}
```

---

### Step 4: Export API Service in Package Index
Update `libs/api-client/src/index.ts`:

```typescript
export * from './lib/axios-client';
export * from './lib/api-client.service';
export * from './lib/auth.api';
export * from './lib/appointments.api';
export * from './lib/models';
```

---

## 4. Consuming in Angular Apps (`hospital-admin` & `patient-web`)

Now, components, page views, or interceptors in any frontend app import and consume API services directly from `@hospital-services/api-client`:

### Direct Auth & Interceptor Usage Example:

```typescript
// apps/hospital-admin/src/app/core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthApiService } from '@hospital-services/api-client';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authApi = inject(AuthApiService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authApi.logout().subscribe(); // Invalidates session & clears signal state
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
```

### Component Usage Example:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { AppointmentsApiService, Appointment } from '@hospital-services/api-client';

@Component({
  selector: 'app-appointments-list',
  standalone: true,
  template: `
    <h2>Appointments</h2>
    <ul>
      @for (apt of appointments(); track apt.id) {
        <li>{{ apt.date }} - {{ apt.status }}</li>
      }
    </ul>
  `,
})
export class AppointmentsListComponent implements OnInit {
  private readonly appointmentsApi = inject(AppointmentsApiService);
  
  readonly appointments = signal<Appointment[]>([]);

  ngOnInit(): void {
    this.appointmentsApi.getAppointments().subscribe({
      next: (data) => this.appointments.set(data),
      error: (err) => console.error('Failed to load appointments', err),
    });
  }
}
```

---

## 5. Summary Cheat Sheet

| Task | File Location | Rule |
| :--- | :--- | :--- |
| **Add Interfaces/Types** | `libs/api-client/src/lib/models/<name>.model.ts` | Always export from `models/index.ts` |
| **Add API Endpoint Calls** | `libs/api-client/src/lib/<name>.api.ts` | Inject `ApiClientService`, return `this.api.get/post/put/delete` |
| **Expose to Monorepo** | `libs/api-client/src/index.ts` | Add `export * from './lib/<name>.api';` |
| **Import in Angular** | Any component/service | `import { ... } from '@hospital-services/api-client';` |
