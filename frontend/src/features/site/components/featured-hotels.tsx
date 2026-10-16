import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HotelCard } from "@/components/cards/hotel-card"
import { hotelApi } from "@/features/hotels/api/hotel.api"
import type { Hotel } from "@/features/hotels/types"

export function FeaturedHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    hotelApi
      .list({ limit: 4 })
      .then((res) => {
        if (!ignore) {
          setHotels((res.hotels as Hotel[]) || [])
        }
      })
      .catch((err) => console.error("Failed to fetch hotels:", err))
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section id="hotels" className="py-20 md:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="text-accent font-medium text-sm uppercase tracking-widest mb-4">
              Premium Stays
            </p>
            <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-balance">
              Handpicked Hotels for Your Comfort
            </h2>
          </div>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start md:self-auto"
            render={<Link to="/hotels" />}
          >
            View All Hotels
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* Hotels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              Loading featured hotels...
            </div>
          ) : hotels.length === 0 ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              No hotels found.
            </div>
          ) : (
            hotels.map((hotel) => (
              <HotelCard key={hotel._id} hotel={hotel} />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
