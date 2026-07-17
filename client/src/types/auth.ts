export type UserRole = "ADMIN" | "ORGANIZER" | "TEAM_OWNER" | "PLAYER" | "FRANCHISE_OWNER";

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPayload {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  role: UserRole;
  terms: boolean;
}

export interface ApiErrorShape {
  success: false;
  message: string;
  errors?: { path: string; message: string }[];
}
