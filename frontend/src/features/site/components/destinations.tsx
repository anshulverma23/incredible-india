import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ArrowRight } from "lucide-react"
import { destinationApi } from "@/features/destinations/api/destination.api"
import { destinationPath } from "@/features/destinations/lib/destination-path"
import type { Destination } from "@/features/destinations/types"

export function Destinations() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    destinationApi
      .list({ limit: 5 })
      .then((res) => {
        if (!ignore) {
          setDestinations((res.destinations as Destination[]) || [])
        }
      })
      .catch((err) => console.error("Failed to fetch destinations:", err)) 
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section id="destinations" className="py-20 md:py-32 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="text-accent font-medium text-sm uppercase tracking-widest mb-4">
              Popular Destinations
            </p>
            <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-balance">
              Explore India&apos;s Most Enchanting Places
            </h2>
            <p className="text-muted-foreground text-lg text-pretty mt-6">
              Each region of India tells a unique story. Discover the diverse
              landscapes, cultures, and experiences that await you.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start md:self-auto"
            render={<Link to="/destinations" />}
          >
            View All Destinations
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* Destinations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              Loading destinations...
            </div>
          ) : destinations.length === 0 ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              No destinations found.
            </div>
          ) : (
            destinations.slice(0, 5).map((destination, index) => (
              <Link
                to={destinationPath(destination)}
                key={destination._id}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer ${
                  index === 0 ? "md:col-span-2 md:row-span-2" : ""
                }`}
              >
                <div
                  className={`relative ${
                    index === 0 ? "aspect-square md:aspect-auto md:h-full min-h-[400px]" : "aspect-[4/5]"
                  }`}
                >
                  <img
                    loading="lazy" decoding="async"
                    src={destination.gallery?.[0]?.url || "https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=2127&auto=format&fit=crop"}
                    alt={`${destination.name} - scenic travel destination in India`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 text-white/90 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>{destination.city}, {destination.state}</span>
                  </div>
                  <h3
                    className={`font-manrope font-bold text-white mb-3 ${
                      index === 0 ? "text-3xl md:text-4xl" : "text-2xl"
                    }`}
                  >
                    {destination.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {destination.tags?.slice(0, 3).map((highlight) => (
                      <Badge
                        key={highlight}
                        variant="secondary"
                        className="bg-white/20 text-white hover:bg-white/40 backdrop-blur-sm border-0"
                      >
                        {highlight}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
