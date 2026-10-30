
import type { CloudImage } from "@/types"
import type { Destination } from "@/features/destinations/types"

export interface Hotel {
  _id: string
  slug?: string
  name: string
  description: string
  images: CloudImage[]
  location: {
    address: string
    city: string
    state?: string
    country: string
    coordinates?: { lat: number; lng: number }
  }
  amenities: string[]
  hotelType: string
  destination?: string | Destination
  rating: number
  numReviews: number
  isActive: boolean
  minPrice?: number | null
  /** ADMIN ONLY (booking detail for admins): contact used to confirm booking requests. */
  ownerContact?: OwnerContact | null
  createdAt?: string
}

export interface OwnerContact {
  name?: string
  phone?: string
  email?: string
}

export interface Room {
  _id: string
  hotel: string
  roomType: string
  price: number
  capacity: number
  totalRooms: number
  amenities: string[]
  images: CloudImage[]
  isAvailable: boolean
}
