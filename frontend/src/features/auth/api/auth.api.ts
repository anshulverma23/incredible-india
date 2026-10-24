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
    api.post<AuthResponse>("/auth/register", body),
  login: (body: LoginPayload) => api.post<AuthResponse>("/auth/login", body),
  google: (idToken: string) =>
    api.post<AuthResponse>("/auth/google", { idToken }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.put<AuthResponse>(`/auth/reset-password/${token}`, { password }),
  verifyEmail: (token: string) =>
    api.get<{ message: string }>(`/auth/verify-email/${token}`),
  changePassword: (body: ChangePasswordPayload) =>
    api.put<{ message: string }>("/auth/change-password", body),
  me: () => api.get<{ user: User }>("/auth/me"),
  logout: () => api.post<{ message: string }>("/auth/logout"),
};