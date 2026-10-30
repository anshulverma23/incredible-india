import { api, http, ApiError, type QueryParams } from "@/lib/axios";
import type { PaginatedResponse } from "@/types";
import type { Booking, RefundPreview } from "@/features/bookings/types";

/** A fresh random key per "Book" click: if the request is retried (flaky network, double click) the server returns the SAME booking. */
const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const bookingApi = {
  create: (body: Record<string, unknown>, idempotencyKey: string = newIdempotencyKey()) =>
    api.post<{ booking: Booking; existing: boolean }>("/bookings", body, { headers: { "Idempotency-Key": idempotencyKey } }),
  my: (params: QueryParams = {}) => api.get<PaginatedResponse<Booking> & { bookings: Booking[] }>("/bookings/my", { limit: 50, ...params }),
  get: (id: string) => api.get<{ booking: Booking; refundPreview?: RefundPreview }>(`/bookings/${id}`),
  cancel: (id: string, reason?: string) =>
    api.put<{ booking: Booking; refund: { amount: number; percent: number } }>(`/bookings/${id}/cancel`, { reason }),
  applyCoupon: (id: string, couponCode: string) =>
    api.put<{ booking: Booking }>(`/bookings/${id}/apply-coupon`, { couponCode }),
  /** Downloads the PDF invoice via an authenticated request (a plain <a href> can't send the Bearer token). */
  downloadInvoice: async (id: string, invoiceNumber: string) => {
    let blob: Blob;
    try {
      const res = await http.get<Blob>(`/bookings/${id}/invoice`, { responseType: "blob" });
      blob = res.data;
    } catch (err) {
      if (err instanceof ApiError) throw new ApiError("Could not download invoice", err.status);
      throw err;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  /** Customer accepts the final price -> booking moves to "awaiting payment". */
  approve: (id: string) => api.put<{ booking: Booking }>(`/bookings/${id}/approve`),
  /** Admin: final price (before tax) agreed with the hotel owner. */
  sendQuote: (id: string, body: { finalPrice: number; validHours?: number; note?: string }) =>
    api.put<{ booking: Booking }>(`/bookings/${id}/quote`, body),
  /** Admin: the hotel cannot host this stay. */
  decline: (id: string, reason: string) => api.put<{ booking: Booking }>(`/bookings/${id}/decline`, { reason }),
  /** Admin: private note (e.g. "called owner"). Returns all notes. */
  addNote: (id: string, note: string) => api.post<{ adminNotes: NonNullable<Booking["adminNotes"]> }>(`/bookings/${id}/notes`, { note }),
  adminList: (params: QueryParams = {}) => api.get<PaginatedResponse<Booking>>("/bookings", params),
  updateStatus: (id: string, bookingStatus: string) =>
    api.put<{ booking: Booking }>(`/bookings/${id}/status`, { bookingStatus }),
  /** Admin cancel with an optional refund override (0-100). */
  adminCancel: (id: string, reason: string, refundPercent?: number) =>
    api.put<{ booking: Booking; refund: { amount: number; percent: number } }>(`/bookings/${id}/cancel`, { reason, refundPercent }),
};
