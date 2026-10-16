import type { Hotel } from "@/features/hotels/types"
import type { Destination } from "@/features/destinations/types"
import type { TourPackage } from "@/features/packages/types"

export type WishlistItemType = "Destination" | "Hotel" | "Package"

export interface WishlistItem {
  itemType: WishlistItemType
  item: Destination | Hotel | TourPackage
  addedAt: string
}

export interface Wishlist {
  _id: string
  user: string
  items: WishlistItem[]
}
