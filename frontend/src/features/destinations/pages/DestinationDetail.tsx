import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { MapPin, Star, Clock, Tag, ArrowRight, ChevronLeft, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { HotelCard } from "@/components/cards/hotel-card"
import { PackageCard } from "@/components/cards/package-card"
import { PageMeta } from "@/components/common/page-meta"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import { destinationApi } from "@/features/destinations/api/destination.api"
import { destinationPath, isObjectId } from "@/features/destinations/lib/destination-path"
import type { Destination } from "@/features/destinations/types"
import type { Hotel } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

export default function DestinationPage() {
  // URL is /destinations/:slug (old links with the MongoDB id still work and are redirected to the slug)
  const { slug = "" } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [destination, setDestination] = useState<Destination | null>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    if (!slug) return
    // The `slug` route param can change without remounting this page (e.g.
    // navigating between two destinations' pages), so this loading flag has
    // to be reset from inside the effect itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    destinationApi
      .get(slug)
      .then(({ destination, hotels, packages }) => {
        setDestination(destination)
        setHotels(hotels || [])
        setPackages(packages || [])
        // Old id-based link -> show the SEO slug in the address bar
        if (isObjectId(slug) && destination.slug && destination.slug !== slug) {
          navigate(destinationPath(destination), { replace: true })
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading destination...</p>
        </div>
      </main>
    )
  }

  if (error || !destination) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground text-center px-4">
          <AlertCircle className="size-12 text-destructive" />
          <h2 className="text-2xl font-bold text-foreground">Destination Not Found</h2>
          <p>Sorry, we couldn't load this destination. It may not exist or there was a connection issue.</p>
          <Button render={<Link to="/destinations" />} className="mt-2">
            <ChevronLeft className="size-4 mr-2" /> Back to Destinations
          </Button>
        </div>
      </main>
    )
  }

  const gallery = destination.gallery || []
  const heroImage = gallery[activeImage]?.url || null

  return (
    <main className="min-h-screen bg-background">
      <PageMeta
        title={`${destination.name}, ${destination.state} - Travel Guide, Hotels & Tour Packages | Incredible India Travel`}
        description={destination.description.replace(/\s+/g, " ").trim().slice(0, 155)}
        canonical={destinationPath(destination)}
      />
      {/* Hero Section */}
      <section className="relative h-[60vh] md:h-[75vh] overflow-hidden">
        {heroImage ? (
          <img
            loading="eager" fetchPriority="high"
            src={heroImage}
            alt={destination.name}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <Link
            to="/destinations"
            className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ChevronLeft className="size-4" /> All Destinations
          </Link>
          <div className="flex flex-wrap gap-2 mb-3">
            {destination.tags?.slice(0, 4).map((tag) => (
              <Badge key={tag} className="bg-white/20 text-white backdrop-blur-sm border-white/30">
                <Tag className="size-3 mr-1" />{tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="font-manrope text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
              {destination.name}
            </h1>
            <WishlistButton itemType="Destination" itemId={destination._id} />
          </div>
          <Link
            to={`/plan-trip?destination=${encodeURIComponent(destination.name)}`}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs text-white backdrop-blur-sm hover:bg-white/30"
          >
            Plan a trip here
          </Link>
          <p className="text-white/90 text-lg flex items-center gap-2">
            <MapPin className="size-5" />
            {[destination.city, destination.state, destination.country].filter(Boolean).join(", ")}
          </p>
        </div>
      </section>

      {/* Thumbnail Gallery */}
      {gallery.length > 1 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {gallery.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  i === activeImage ? "border-primary scale-105 shadow-lg" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img loading="lazy" decoding="async" src={img.url} alt={`${destination.name} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left: Description & Info */}
          <div className="lg:col-span-2 space-y-10">
            {/* About */}
            <div>
              <p className="text-accent font-medium text-sm uppercase tracking-widest mb-2">About</p>
              <h2 className="font-manrope text-3xl font-bold text-foreground mb-4">Discover {destination.name}</h2>
              <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-line">
                {destination.description}
              </p>
            </div>

            {/* Hotels in this Destination */}
            {hotels.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-accent font-medium text-sm uppercase tracking-widest mb-1">Places to Stay</p>
                    <h3 className="font-manrope text-2xl font-bold text-foreground">Hotels in {destination.name}</h3>
                  </div>
                  <Button variant="outline" render={<Link to={`/hotels?city=${destination.city}`} />}>
                    View All <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {hotels.slice(0, 4).map((hotel) => (
                    <HotelCard key={hotel._id} hotel={hotel} />
                  ))}
                </div>
              </div>
            )}

            {/* Packages for this Destination */}
            {packages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-accent font-medium text-sm uppercase tracking-widest mb-1">Things to Do</p>
                    <h3 className="font-manrope text-2xl font-bold text-foreground">Tour Packages</h3>
                  </div>
                  <Button variant="outline" render={<Link to="/packages" />}>
                    View All <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {packages.slice(0, 4).map((pkg) => (
                    <PackageCard key={pkg._id} pkg={pkg} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Info Sidebar */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <Card className="p-6 space-y-5 sticky top-24">
              <h3 className="font-semibold text-lg text-foreground border-b border-border pb-3">
                Destination Info
              </h3>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Location</p>
                    <p className="text-muted-foreground">
                      {[destination.city, destination.state, destination.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>

                {destination.bestTimeToVisit && (
                  <div className="flex items-start gap-3">
                    <Clock className="size-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Best Time to Visit</p>
                      <p className="text-muted-foreground">{destination.bestTimeToVisit}</p>
                    </div>
                  </div>
                )}

                {destination.tags && destination.tags.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Tag className="size-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground mb-2">Popular For</p>
                      <div className="flex flex-wrap gap-1.5">
                        {destination.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Star className="size-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Available Options</p>
                    <p className="text-muted-foreground">
                      {hotels.length} hotels · {packages.length} packages
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex flex-col gap-3">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  render={<Link to={`/hotels?city=${destination.city}`} />}
                >
                  Browse Hotels
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link to="/packages" />}
                >
                  Browse Packages
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
