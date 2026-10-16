import { api } from "@/lib/axios"
import type { Wishlist, WishlistItemType } from "@/features/wishlist/types"

export const wishlistApi = {
  get: () => api.get<{ wishlist: Wishlist }>("/wishlist"),
  add: (itemType: WishlistItemType, itemId: string) => api.post<{ wishlist: Wishlist }>("/wishlist", { itemType, itemId }),
  remove: (itemId: string) => api.delete<{ wishlist: Wishlist }>(`/wishlist/${itemId}`),
}
