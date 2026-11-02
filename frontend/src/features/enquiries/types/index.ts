import type { Booking } from "@/features/bookings/types"
import type { TourPackage } from "@/features/packages/types"
import type { User } from "@/features/auth/types"

export type EnquiryStatus =
  | "new"
  | "in_discussion"
  | "quotation_sent"
  | "revision_requested"
  | "counter_offered"
  | "accepted"
  | "booked"
  | "rejected"
  | "cancelled"

export type ContactMethod = "email" | "phone" | "whatsapp" | "chat"

export interface EnquiryMessage {
  sender: "customer" | "admin" | "system"
  kind: "message" | "quotation" | "revision_request" | "counter_offer" | "counter_response" | "status"
  text: string
  at: string
}

export interface QuotationHotel {
  name: string
  location?: string
  nights?: number
  roomType?: string
  mealPlan?: string
}

export interface Quotation {
  version: number
  /** Package price BEFORE GST */
  amount: number
  tax: number
  /** Price incl. GST - what the customer pays */
  totalAmount: number
  perPerson?: number
  travellers?: number
  days?: number
  nights?: number
  itinerary: { day: number; title: string; description?: string }[]
  hotels: QuotationHotel[]
  activities: string[]
  transport?: string
  inclusions: string[]
  exclusions: string[]
  note?: string
  advanceAllowed: boolean
  advancePercent?: number
  validUntil: string
  sentAt: string
}

export interface PackageEnquiry {
  _id: string
  enquiryNumber: string
  user: string | User
  package: string | (Pick<TourPackage, "_id" | "name" | "slug" | "gallery" | "duration" | "price"> & Partial<Pick<TourPackage, "itinerary" | "included" | "excluded">> & { destination?: { name: string; city?: string; state?: string } | string })
  request: {
    startDate: string
    adults: number
    children: number
    days?: number
    rooms?: number
    budget?: { amount: number; basis: "per_person" | "total" }
    requirements?: string
    contactMethod: ContactMethod
    phone?: string
  }
  status: EnquiryStatus
  statusHistory?: { status: EnquiryStatus; at: string; note?: string }[]
  messages: EnquiryMessage[]
  quotation?: Quotation
  quotationHistory?: Quotation[]
  counterOffer?: { amount: number; note?: string; at: string; status: "pending" | "accepted" | "rejected" | "superseded" }
  paymentOption?: "full" | "advance"
  booking?: string | Booking
  /** Server-computed flags */
  quotationExpired: boolean
  advanceAvailable: boolean
  lastMessageBy: "customer" | "admin" | "system"
  lastActivityAt: string
  createdAt: string
  /** ADMIN ONLY */
  adminNotes?: { note: string; at: string; by?: string | { name: string } }[]
}

export interface EnquiryStats {
  byStatus: Record<EnquiryStatus, number>
  awaitingAdmin: number
}

export interface QuotationInput {
  amount: number
  validDays?: number
  days?: number
  nights?: number
  itinerary: { day: number; title: string; description?: string }[]
  hotels: QuotationHotel[]
  activities: string[]
  transport?: string
  inclusions: string[]
  exclusions: string[]
  note?: string
  advanceAllowed: boolean
  advancePercent?: number
}

export interface CreateEnquiryInput {
  packageId: string
  startDate: string
  adults: number
  children: number
  days?: number
  rooms?: number
  budgetAmount?: number
  budgetBasis?: "per_person" | "total"
  requirements?: string
  contactMethod: ContactMethod
  phone?: string
}
