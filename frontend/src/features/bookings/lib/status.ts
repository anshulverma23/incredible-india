import type { BookingStatus, PaymentStatus } from "@/features/bookings/types"

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending_confirmation: "bg-amber-100 text-amber-800",
  awaiting_approval: "bg-sky-100 text-sky-800",
  declined: "bg-destructive/10 text-destructive",
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-blue-100 text-blue-800",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_confirmation: "Pending confirmation",
  awaiting_approval: "Price ready - approve",
  declined: "Not available",
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Cancelled & refunded",
  failed: "Failed",
  expired: "Expired",
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
}

/** Hotel request that is still being handled (nothing to pay yet). */
export const isRequestStage = (b: { bookingStatus: BookingStatus }) => b.bookingStatus === "pending_confirmation" || b.bookingStatus === "awaiting_approval"

/** The admin sent a final price and the customer can still accept it. */
export const canApprovePrice = (b: { bookingStatus: BookingStatus; expiresAt?: string }) =>
  b.bookingStatus === "awaiting_approval" && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now())

/** A booking the customer can still pay for. */
export const isPayable = (b: { bookingStatus: BookingStatus; paymentStatus: PaymentStatus; expiresAt?: string }) =>
  b.bookingStatus === "pending" && b.paymentStatus !== "paid" && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now())
