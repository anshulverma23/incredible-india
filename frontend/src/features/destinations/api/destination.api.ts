import { api, type QueryParams } from "@/lib/axios"
import type { PaginatedResponse } from "@/types"
import type { Destination, DestinationWeather } from "@/features/destinations/types"
import type { Hotel } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

export const destinationApi = {
  list: (params: QueryParams = {}) => api.get<PaginatedResponse<Destination>>("/destinations", params),
  /** `idOrSlug` accepts the SEO slug (public pages) or the MongoDB id (admin / old links). */
  get: (idOrSlug: string) => api.get<{ destination: Destination; hotels: Hotel[]; packages: TourPackage[] }>(`/destinations/${encodeURIComponent(idOrSlug)}`),
  weather: (idOrSlug: string) =>
    api.get<{ success: boolean; weather?: DestinationWeather; message?: string }>(`/destinations/${encodeURIComponent(idOrSlug)}/weather`),
  create: (formData: FormData) => api.post("/destinations", formData),
  update: (id: string, formData: FormData) => api.put(`/destinations/${id}`, formData),
  remove: (id: string) => api.delete(`/destinations/${id}`),
}
