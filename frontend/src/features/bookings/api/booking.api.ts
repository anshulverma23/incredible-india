
import { api, http, ApiError, type QueryParams } from "@/lib/axios";
import type { PaginatedResponse } from "@/types";
import type { Booking, RefundPreview } from "@/features/bookings/types";

/** A fresh random key per "Book" click. */
const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const bookingApi = {
  // Create booking / hotel booking request
  create: (
    body: Record<string, unknown>,
    idempotencyKey: string = newIdempotencyKey()
  ) =>
    api.post<{ booking: Booking; existing: boolean }>(
      "/bookings",
      body,
      { headers: { "Idempotency-Key": idempotencyKey } }
    ),

  // Get logged-in user's bookings
  my: (params: QueryParams = {}) =>
    api.get<PaginatedResponse<Booking> & { bookings: Booking[] }>(
      "/bookings/my",
      { limit: 50, ...params }
    ),

  // Get single booking
  get: (id: string) =>
    api.get<{ booking: Booking; refundPreview?: RefundPreview }>(
      `/bookings/${id}`
    ),

  // Cancel booking
  cancel: (id: string, reason?: string) =>
    api.put<{
      booking: Booking;
      refund: { amount: number; percent: number };
    }>(`/bookings/${id}/cancel`, { reason }),

  // Apply coupon
  applyCoupon: (id: string, couponCode: string) =>
    api.put<{ booking: Booking }>(
      `/bookings/${id}/apply-coupon`,
      { couponCode }
    ),

  // Download PDF invoice
  downloadInvoice: async (id: string, invoiceNumber: string) => {
    let blob: Blob;

    try {
      const res = await http.get<Blob>(
        `/bookings/${id}/invoice`,
        { responseType: "blob" }
      );

      blob = res.data;
    } catch (err) {
      if (err instanceof ApiError) {
        throw new ApiError("Could not download invoice", err.status);
      }

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

  // Admin: Get all bookings
  adminList: (params: QueryParams = {}) =>
    api.get<PaginatedResponse<Booking>>("/bookings", params),

  // Admin: Update booking status
  updateStatus: (id: string, bookingStatus: string) =>
    api.put<{ booking: Booking }>(
      `/bookings/${id}/status`,
      { bookingStatus }
    ),

  // Admin: Cancel booking with optional refund override
  adminCancel: (id: string, reason: string, refundPercent?: number) =>
    api.put<{
      booking: Booking;
      refund: { amount: number; percent: number };
    }>(`/bookings/${id}/cancel`, { reason, refundPercent }),

  // Admin: Add internal note to hotel booking request
  addNote: (id: string, note: string) =>
    api.post<{ booking: Booking }>(
      `/bookings/${id}/notes`,
      { note }
    ),

  // Admin: Send or revise final price quote
  sendQuote: (
    id: string,
    body: {
      finalPrice: number;
      validHours?: number;
      note?: string;
    }
  ) =>
    api.put<{ booking: Booking }>(
      `/bookings/${id}/quote`,
      body
    ),

  // Admin: Decline hotel booking request
  decline: (id: string, reason: string) =>
    api.put<{ booking: Booking }>(
      `/bookings/${id}/decline`,
      { reason }
    ),

  // Customer: Approve final hotel price
  approve: (id: string) =>
    api.put<{ booking: Booking }>(
      `/bookings/${id}/approve`
    ),
};
