import type { CloudImage } from "@/types"

export interface Review {
  _id: string
  user: { _id: string; name: string; avatar?: CloudImage } | string
  targetType: "hotel" | "package"
  hotel?: string | { _id: string; name: string }
  package?: string | { _id: string; name: string }
  rating: number
  comment: string
  images: CloudImage[]
  isVerifiedBooking: boolean
  createdAt: string
}
