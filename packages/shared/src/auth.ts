import type { ID } from './common';

export type Role = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'CLERK' | 'VIEWER';

export interface AuthUser {
  id: ID;
  email: string;
  name: string;
  role: Role;
  accountBookId?: ID;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
  accountBookId?: ID;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
