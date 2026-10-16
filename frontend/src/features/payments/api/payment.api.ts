import { api } from "@/lib/axios";
import type { Booking } from "@/features/bookings/types";

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const paymentApi = {
  createRazorpayOrder: (bookingId: string) =>
    api.post<{ orderId: string; amount: number; currency: string; keyId: string }>("/payment/create-order", { bookingId }),
  /** The server verifies the signature, re-checks the payment with Razorpay and only then confirms the booking. */
  verifyRazorpay: (body: RazorpayResponse) =>
    api.post<{ booking: Booking; alreadyProcessed?: boolean }>("/payment/verify", body),
  /** Informational: tells the backend a checkout attempt failed (the webhook remains the source of truth). */
  reportFailure: (orderId: string, reason?: string) =>
    api.post("/payment/failed", { razorpay_order_id: orderId, reason }),
};
