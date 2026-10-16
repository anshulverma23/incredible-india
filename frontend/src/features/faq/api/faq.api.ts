import { api } from "@/lib/axios"
import type {
  FAQFormData,
  FAQListResponse,
  FAQResponse,
} from "@/features/faq/types"

export const faqApi = {
  // Get all active FAQs
  list: (category?: string) => {
    const query = category
      ? `?category=${encodeURIComponent(category)}`
      : ""

    return api.get<FAQListResponse>(`/faqs${query}`)
  },

  // Get single FAQ
  get: (id: string) =>
    api.get<FAQResponse>(`/faqs/${id}`),

  // Create FAQ
  create: (data: FAQFormData) =>
    api.post<FAQResponse>("/faqs", data),

  // Update FAQ
  update: (id: string, data: FAQFormData) =>
    api.put<FAQResponse>(`/faqs/${id}`, data),

  // Delete FAQ
  remove: (id: string) =>
    api.delete<{
      success: boolean
      message: string
    }>(`/faqs/${id}`),
}