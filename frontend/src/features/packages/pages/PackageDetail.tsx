import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Calendar, Check, X, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { StarRating } from "@/components/common/star-rating"
import { PageMeta } from "@/components/common/page-meta"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import { ReviewSection } from "@/features/reviews/components/review-section"
import { formatDate, formatINR } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { packageApi } from "@/features/packages/api/package.api"
import { isObjectId, packagePath } from "@/features/packages/lib/package-path"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { ApiError } from "@/lib/axios"
import type { TourPackage } from "@/features/packages/types"

export default function PackageDetailsPage() {
  // URL is /packages/:slug (old links with the MongoDB id still work and are redirected to the slug)
  const { slug = "" } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pkg, setPkg] = useState<TourPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)

  const [travelDate, setTravelDate] = useState("")
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [bookingError, setBookingError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    packageApi
      .get(slug)
      .then((res) => {
        setPkg(res.package)
        // Old id-based link -> show the SEO slug in the address bar
        if (isObjectId(slug) && res.package.slug && res.package.slug !== slug) {
          navigate(packagePath(res.package), { replace: true })
        }
      })
      .catch(() => setPkg(null))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  if (loading) return <PageLoader label="Loading package..." />
  if (!pkg) return (
    <main className="min-h-screen pt-32 pb-20 text-center">
      <p className="text-muted-foreground">Package not found.</p>
    </main>
  )

  const destinationName = typeof pkg.destination === "object" ? pkg.destination.name : ""
  const totalGuests = adults + children
  const totalEstimate = pkg.price * totalGuests
  const images = pkg.gallery

  const handleBook = async () => {
    setBookingError("")
    if (!user) {
      navigate("/login")
      return
    }
    if (!travelDate) {
      setBookingError("Please select a travel date")
      return
    }
    setSubmitting(true)
    try {
      const { booking } = await bookingApi.create({
        bookingType: "package",
        packageId: pkg._id,
        travelDate,
        guests: { adults, children },
      })
      navigate(`/checkout/${booking._id}`)
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Could not create booking")
    } finally {
      setSubmitting(false)
    }
  }

  const metaDescription = pkg.description.replace(/\s+/g, " ").trim().slice(0, 155)

  return (
    <main className="min-h-screen pt-24 pb-20 bg-background">
      <PageMeta
        title={`${pkg.name} - ${pkg.duration.days} Days / ${pkg.duration.nights} Nights${destinationName ? ` ${destinationName}` : ""} Tour Package | Incredible India Travel`}
        description={metaDescription}
        canonical={packagePath(pkg)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="relative aspect-[16/8] overflow-hidden rounded-2xl bg-muted">
            {images[activeImage] ? (
              <img loading="lazy" decoding="async" src={images[activeImage].url} alt={pkg.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
            )}
            <div className="absolute right-4 top-4">
              <WishlistButton itemType="Package" itemId={pkg._id} />
            </div>
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.public_id}
                  onClick={() => setActiveImage(i)}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImage ? "border-primary" : "border-transparent"}`}
                >
                  <img loading="lazy" decoding="async" src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <Badge className="mb-3 bg-primary/10 text-primary">{pkg.packageType}</Badge>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{pkg.name}</h1>
            {destinationName && (
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" /> {destinationName}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <StarRating rating={pkg.rating} size="md" />
              <span className="text-sm text-muted-foreground">{pkg.duration.days} Days / {pkg.duration.nights} Nights</span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="size-3.5" /> Max {pkg.maxGroupSize}</span>
            </div>

            <p className="mt-6 leading-relaxed text-foreground/90">{pkg.description}</p>

            {pkg.itinerary.length > 0 && (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-4">Itinerary</h2>
                <div className="space-y-4">
                  {pkg.itinerary.map((day) => (
                    <div key={day.day} className="flex gap-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif font-bold text-primary">
                        {day.day}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{day.title}</p>
                        {day.description && <p className="text-sm text-muted-foreground">{day.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {pkg.included.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Included</h3>
                  <ul className="space-y-2 text-sm">
                    {pkg.included.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-foreground/90"><Check className="size-4 text-primary shrink-0" /> {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.excluded.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Excluded</h3>
                  <ul className="space-y-2 text-sm">
                    {pkg.excluded.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-muted-foreground"><X className="size-4 text-destructive shrink-0" /> {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {pkg.amenities && pkg.amenities.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 font-semibold text-foreground">Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {pkg.amenities.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
                </div>
              </div>
            )}

            <div className="mt-10">
              <ReviewSection targetType="package" targetId={pkg._id} />
            </div>
          </div>

          {/* Booking widget */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28 p-5">
              <p className="text-sm text-muted-foreground">Starting from</p>
              <p className="font-serif text-3xl font-bold text-foreground">{formatINR(pkg.price)}<span className="text-sm font-normal text-muted-foreground"> /person</span></p>

              {bookingError && <Alert variant="destructive" className="mt-4">{bookingError}</Alert>}

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Calendar className="size-3" /> Travel Date</label>
                  {pkg.departures && pkg.departures.length > 0 ? (
                    <Select value={travelDate} onChange={(e) => setTravelDate(e.target.value)}>
                      <option value="">Select a departure</option>
                      {pkg.departures.map((d) => (
                        <option key={d.date} value={d.date.slice(0, 10)} disabled={d.seatsLeft < totalGuests}>
                          {formatDate(d.date)} - {d.seatsLeft === 0 ? "Sold out" : d.seatsLeft < totalGuests ? `only ${d.seatsLeft} left` : `${d.seatsLeft} seats left`}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <input
                      type="date"
                      value={travelDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Adults</label>
                    <Select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Children</label>
                    <Select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{formatINR(pkg.price)} x {totalGuests} traveler{totalGuests > 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold text-foreground">
                    <span>Estimated total</span>
                    <span>{formatINR(totalEstimate)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Taxes calculated at checkout</p>
                </div>

                <Button onClick={handleBook} disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-5">
                  {submitting ? "Creating booking..." : user ? "Book Package" : "Log in to Book"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
