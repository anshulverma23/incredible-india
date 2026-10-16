import type { CloudImage } from "@/types"
import type { Destination } from "@/features/destinations/types"

export interface ItineraryDay {
  day: number
  title: string
  description?: string
}

export interface TourPackage {
  _id: string
  name: string
  description: string
  destination: string | Destination
  duration: { days: number; nights: number }
  price: number
  itinerary: ItineraryDay[]
  included: string[]
  excluded: string[]
  gallery: CloudImage[]
  packageType: string
  maxGroupSize: number
  startDates: string[]
  amenities?: string[]
  /** Upcoming departures with live seat availability (package detail endpoint only) */
  departures?: { date: string; seatsLeft: number }[]
  rating: number
  numReviews: number
  isActive: boolean
}
