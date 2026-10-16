import { api, type QueryParams } from "@/lib/axios"
import type { PaginatedResponse } from "@/types"
import type { Destination, DestinationWeather } from "@/features/destinations/types"
import type { Hotel } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

export const destinationApi = {
  list: (params: QueryParams = {}) => api.get<PaginatedResponse<Destination>>("/destinations", params),
  get: (id: string) => api.get<{ destination: Destination; hotels: Hotel[]; packages: TourPackage[] }>(`/destinations/${id}`),
  weather: (id: string) =>
    api.get<{ success: boolean; weather?: DestinationWeather; message?: string }>(`/destinations/${id}/weather`),
  create: (formData: FormData) => api.post("/destinations", formData),
  update: (id: string, formData: FormData) => api.put(`/destinations/${id}`, formData),
  remove: (id: string) => api.delete(`/destinations/${id}`),
}
