export type Role = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'NURSE' | 'STAFF';

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface SharedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role | string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  fullName: string;
  role?: Role | string;
  phone?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthApiResponse {
  message: string;
  user: SharedUser;
}
