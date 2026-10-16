import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { wishlistApi } from "@/features/wishlist/api/wishlist.api"
import type { WishlistItemType } from "@/features/wishlist/types"
import { ApiError } from "@/lib/axios"

export function WishlistButton({ itemType, itemId }: { itemType: WishlistItemType; itemId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [inWishlist, setInWishlist] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    wishlistApi
      .get()
      .then(({ wishlist }) => {
        setInWishlist(wishlist.items.some((i) => i.itemType === itemType && (i.item as { _id: string })._id === itemId))
      })
      .catch(() => {})
  }, [user, itemType, itemId])

  const toggle = async () => {
    if (!user) {
      navigate("/login")
      return
    }
    setLoading(true)
    try {
      if (inWishlist) {
        await wishlistApi.remove(itemId)
        setInWishlist(false)
        toast("Removed from wishlist")
      } else {
        await wishlistApi.add(itemType, itemId)
        setInWishlist(true)
        toast("Added to wishlist")
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border border-border bg-background/90 backdrop-blur-sm transition-colors hover:border-primary",
        inWishlist && "border-primary bg-primary/10"
      )}
    >
      <Heart className={cn("size-4.5", inWishlist ? "fill-primary text-primary" : "text-foreground")} />
    </button>
  )
}
