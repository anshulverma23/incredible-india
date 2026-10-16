import type { BookingStatus, PaymentStatus } from "@/features/bookings/types"

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-blue-100 text-blue-800",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
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

/** A booking the customer can still pay for. */
export const isPayable = (b: { bookingStatus: BookingStatus; paymentStatus: PaymentStatus; expiresAt?: string }) =>
  b.bookingStatus === "pending" && b.paymentStatus !== "paid" && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now())
