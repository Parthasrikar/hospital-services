export type Role = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'NURSE' | 'STAFF';

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface SharedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role | string;
  phone?: string | null;
  pictureUrl?: string | null;
  isProfileComplete?: boolean;
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

export interface GoogleTokenCredentials {
  idToken: string;
  role?: Role | string;
}

export interface CompleteOnboardingCredentials {
  role?: Role | string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  specialization?: string;
  licenseNumber?: string;
  consultationFee?: number;
}

export interface AuthApiResponse {
  message: string;
  user: SharedUser;
  isProfileComplete?: boolean;
}
