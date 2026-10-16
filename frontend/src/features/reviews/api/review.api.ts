import { api, type QueryParams } from "@/lib/axios"
import type { Review } from "@/features/reviews/types"

export interface ReviewEligibility {
  canReview: boolean
  bookingId?: string
  reason?: string
}

export const reviewApi = {
  eligibility: (targetType: "hotel" | "package", targetId: string) => api.get<ReviewEligibility>("/reviews/eligibility", { targetType, targetId }),
  hotelReviews: (hotelId: string) => api.get<{ reviews: Review[] }>(`/reviews/hotel/${hotelId}`),
  packageReviews: (packageId: string) => api.get<{ reviews: Review[] }>(`/reviews/package/${packageId}`),
  adminList: (params: QueryParams = {}) => api.get<{ reviews: Review[]; total: number }>("/reviews", params),
  create: (formData: FormData) => api.post("/reviews", formData),
  update: (id: string, formData: FormData) => api.put(`/reviews/${id}`, formData),
  remove: (id: string) => api.delete(`/reviews/${id}`),
}
