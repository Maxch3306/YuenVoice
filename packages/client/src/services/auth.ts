import api from '@/lib/api';
import type { User } from '@/types';

// ─── Payload Types ──────────────────────────────────────────────

export interface RegisterPayload {
  block: string;
  floor: string;
  unitNumber: string;
  flatPassword: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// ─── API Functions ──────────────────────────────────────────────

export async function register(data: RegisterPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/register', data);
  return response.data;
}

export async function login(data: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/login', data);
  return response.data;
}

export async function refresh(): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/refresh');
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/api/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  password: string
): Promise<void> {
  await api.post('/api/auth/reset-password', { token, password });
}
