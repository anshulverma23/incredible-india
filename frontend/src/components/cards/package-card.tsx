import { Link } from "react-router-dom"
import { Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/common/star-rating"
import { formatINR } from "@/lib/utils"
import type { TourPackage } from "@/features/packages/types"

export function PackageCard({ pkg }: { pkg: TourPackage }) {
  const image = pkg.gallery?.[0]?.url
  const destinationName = typeof pkg.destination === "object" ? pkg.destination.name : ""

  return (
    <Link to={`/packages/${pkg.slug || pkg._id}`} className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt={pkg.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        <Badge className="absolute left-3 top-3 bg-background/90 text-foreground backdrop-blur-sm">{pkg.packageType}</Badge>
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-bold text-foreground line-clamp-1">{pkg.name}</h3>
        {destinationName && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{destinationName}</p>}
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="size-3.5" />
          {pkg.duration.days} Days / {pkg.duration.nights} Nights
        </p>
        <div className="mt-3 flex items-center justify-between">
          <StarRating rating={pkg.rating} />
          <p className="text-sm text-foreground">
            <span className="font-semibold">{formatINR(pkg.price)}</span>
            <span className="text-muted-foreground"> / person</span>
          </p>
        </div>
      </div>
    </Link>
  )
}
