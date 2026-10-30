import type { User } from "@/features/auth/types"
import type { Hotel, Room } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

/**
 * Hotels:   pending_confirmation -> awaiting_approval -> pending (awaiting payment) -> confirmed -> completed
 *           (or declined when the hotel cannot host the stay)
 * Packages: pending (awaiting payment) -> confirmed -> completed
 */
export type BookingStatus =
  | "pending_confirmation"
  | "awaiting_approval"
  | "pending"
  | "confirmed"
  | "cancelled"
  | "failed"
  | "refunded"
  | "completed"
  | "expired"
  | "declined"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded"

export interface Booking {
  _id: string
  /** Human friendly unique reference, e.g. IT-260607-K7M2QX */
  bookingReference: string
  user: string | User
  bookingType: "hotel" | "package"
  hotel?: string | Hotel
  room?: string | Room
  numberOfRooms?: number
  checkIn?: string
  checkOut?: string
  package?: string | TourPackage
  travelDate?: string
  guests: { adults: number; children: number }
  couponCode?: string
  pricing: { basePrice: number; discount: number; tax: number; totalAmount: number }
  paymentStatus: PaymentStatus
  bookingStatus: BookingStatus
  /** Unpaid bookings hold their seats/rooms only until this moment (for a price offer: when the offer lapses). */
  expiresAt?: string
  /** Hotel requests: system estimate (before tax). `pricing` is only final once the status is awaiting_approval or later. */
  estimatedBasePrice?: number
  /** Hotel requests: the final price sent by the admin. */
  quote?: { amount: number; note?: string; sentAt?: string; validUntil?: string }
  approvedAt?: string
  declineReason?: string
  /** ADMIN ONLY - never sent to customers. */
  adminNotes?: { note: string; at: string; by?: string | { name: string } }[]
  statusHistory?: { status: BookingStatus; at: string; note?: string }[]
  cancellation?: { cancelledAt?: string; reason?: string; refundPercent?: number; refundAmount?: number }
  invoiceNumber: string
  confirmedAt?: string
  specialRequests?: string
  createdAt: string
}

export interface RefundPreview {
  paid: boolean
  refundPercent: number
  refundAmount: number
  daysBeforeStart?: number
}
