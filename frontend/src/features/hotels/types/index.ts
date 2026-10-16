import type { CloudImage } from "@/types"
import type { Destination } from "@/features/destinations/types"

export interface Hotel {
  _id: string
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
  createdAt?: string
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
