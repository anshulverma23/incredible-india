import { api } from "@/lib/axios";
import type {
  AuthResponse,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  User,
} from "@/features/auth/types";

export const authApi = {
  register: (body: RegisterPayload) =>
    api.post<AuthResponse>("/api/auth/register", body),
  login: (body: LoginPayload) => api.post<AuthResponse>("/api/auth/login", body),
  google: (idToken: string) =>
    api.post<AuthResponse>("/api/auth/google", { idToken }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/api/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.put<AuthResponse>(`/api/auth/reset-password/${token}`, { password }),
  verifyEmail: (token: string) =>
    api.get<{ message: string }>(`/api/auth/verify-email/${token}`),
  changePassword: (body: ChangePasswordPayload) =>
    api.put<{ message: string }>("/api/auth/change-password", body),
  me: () => api.get<{ user: User }>("/api/auth/me"),
  logout: () => api.post<{ message: string }>("/api/auth/logout"),
};
