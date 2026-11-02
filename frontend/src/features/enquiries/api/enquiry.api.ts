import { api, type QueryParams } from "@/lib/axios"
import type { Booking } from "@/features/bookings/types"
import type { CreateEnquiryInput, EnquiryStats, PackageEnquiry, QuotationInput } from "@/features/enquiries/types"

type One = { enquiry: PackageEnquiry }

export const enquiryApi = {
  /* ---------------- customer ---------------- */
  create: (body: CreateEnquiryInput) => api.post<One>("/enquiries", body),
  my: () => api.get<{ enquiries: PackageEnquiry[] }>("/enquiries/my"),
  get: (id: string) => api.get<One>(`/enquiries/${id}`),
  message: (id: string, text: string) => api.post<One>(`/enquiries/${id}/messages`, { text }),
  accept: (id: string, paymentOption: "full" | "advance") => api.put<One & { booking: Booking }>(`/enquiries/${id}/accept`, { paymentOption }),
  requestRevision: (id: string, note: string) => api.put<One>(`/enquiries/${id}/request-revision`, { note }),
  counterOffer: (id: string, amount: number, note?: string) => api.put<One>(`/enquiries/${id}/counter-offer`, { amount, note }),
  cancel: (id: string, reason?: string) => api.put<One>(`/enquiries/${id}/cancel`, { reason }),

  /* ---------------- admin ---------------- */
  adminList: (params: QueryParams = {}) =>
    api.get<{ enquiries: PackageEnquiry[]; total: number; page: number; pages: number }>("/enquiries/admin", params),
  adminStats: () => api.get<EnquiryStats>("/enquiries/admin/stats"),
  adminGet: (id: string) => api.get<One>(`/enquiries/admin/${id}`),
  adminMessage: (id: string, text: string) => api.post<One>(`/enquiries/admin/${id}/messages`, { text }),
  sendQuotation: (id: string, body: QuotationInput) => api.post<One>(`/enquiries/admin/${id}/quotation`, body),
  decideCounter: (id: string, body: { decision: "accept" | "reject"; note?: string; validDays?: number }) => api.put<One>(`/enquiries/admin/${id}/counter-offer`, body),
  setStatus: (id: string, body: { status: "in_discussion" | "rejected"; note?: string }) => api.put<One>(`/enquiries/admin/${id}/status`, body),
  addNote: (id: string, note: string) => api.post<{ adminNotes: NonNullable<PackageEnquiry["adminNotes"]> }>(`/enquiries/admin/${id}/notes`, { note }),
}
