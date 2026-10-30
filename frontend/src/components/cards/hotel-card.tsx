import { Link } from "react-router-dom"
import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/common/star-rating"
import { formatINR } from "@/lib/utils"
import type { Hotel } from "@/features/hotels/types"

export function HotelCard({ hotel }: { hotel: Hotel }) {
  const image = hotel.images?.[0]?.url

  return (
    <Link
  to={`/hotels/${hotel.slug || hotel._id}`}
  className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg"
>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt={hotel.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        <Badge className="absolute left-3 top-3 bg-background/90 text-foreground backdrop-blur-sm">{hotel.hotelType}</Badge>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-foreground line-clamp-1">{hotel.name}</h3>
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{hotel.location.city}, {hotel.location.state}</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <StarRating rating={hotel.rating} />
          <span className="text-xs text-muted-foreground">{hotel.numReviews} reviews</span>
        </div>
        {hotel.minPrice != null && (
          <p className="mt-2 text-sm text-foreground">
            <span className="font-semibold">{formatINR(hotel.minPrice)}</span>
            <span className="text-muted-foreground"> / night</span>
          </p>
        )}
      </div>
    </Link>
  )
}
