import type { CloudImage } from "@/types"

export interface Destination {
  _id: string
  slug?: string
  name: string
  country: string
  state: string
  city: string
  description: string
  gallery: CloudImage[]
  coordinates?: { lat: number; lng: number }
  bestTimeToVisit?: string
  tags: string[]
  isActive: boolean
}

export interface DestinationWeather {
  temp: number
  feelsLike: number
  condition: string
  icon: string
  humidity: number
}
