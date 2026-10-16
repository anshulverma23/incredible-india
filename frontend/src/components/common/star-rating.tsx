import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "size-3.5" : "size-4"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(dim, i <= Math.round(rating) ? "fill-accent text-accent" : "fill-muted text-muted")}
        />
      ))}
    </div>
  )
}
