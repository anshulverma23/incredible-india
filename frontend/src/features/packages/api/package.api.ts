import { api, type QueryParams } from "@/lib/axios";
import type { PaginatedResponse } from "@/types";
import type { TourPackage } from "@/features/packages/types";

export const packageApi = {
  list: (params: QueryParams = {}) =>
    api.get<PaginatedResponse<TourPackage>>("/packages", params),
  get: (id: string) => api.get<{ package: TourPackage }>(`/packages/${id}`),
  create: (formData: FormData) => api.post("/packages", formData),
  update: (id: string, formData: FormData) =>
    api.put(`/packages/${id}`, formData),
  remove: (id: string) => api.delete(`/packages/${id}`),
};