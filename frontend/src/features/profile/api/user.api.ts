import { api, type QueryParams } from "@/lib/axios";
import type { PaginatedResponse } from "@/types";
import type { User } from "@/features/auth/types";

export const userApi = {
  profile: () => api.get<{ user: User }>("/users/profile"),
  updateProfile: (formData: FormData) =>
    api.put<{ user: User }>("/users/profile", formData),
  adminList: (params: QueryParams = {}) =>
    api.get<PaginatedResponse<User>>("/users", params),
  update: (id: string, body: Record<string, unknown>) =>
    api.put<{ user: User }>(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
};
