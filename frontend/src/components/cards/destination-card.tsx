import { Link } from "react-router-dom"
import { MapPin } from "lucide-react"
import type { Destination } from "@/features/destinations/types"

export function DestinationCard({ destination }: { destination: Destination }) {
  const image = destination.gallery?.[0]?.url

  return (
    <Link to={`/destinations/${destination._id}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl">
      {image ? (
        <img loading="lazy" decoding="async" src={image} alt={destination.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
      ) : (
        <div className="flex h-full items-center justify-center bg-muted text-muted-foreground text-sm">No image</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-center gap-1.5 text-white/80 text-xs mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>{destination.state}, {destination.country}</span>
        </div>
        <h3 className="font-serif text-xl font-bold text-white">{destination.name}</h3>
      </div>
    </Link>
  )
}
