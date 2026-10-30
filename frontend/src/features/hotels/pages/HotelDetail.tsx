import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapPin, Check, Users, BedDouble } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { PageMeta } from "@/components/common/page-meta"
import { StarRating } from "@/components/common/star-rating"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import { MapEmbed } from "@/components/common/map-embed"
import { ReviewSection } from "@/features/reviews/components/review-section"
import { formatINR, nightsBetween } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { hotelApi } from "@/features/hotels/api/hotel.api"
import { hotelPath, isObjectId } from "@/features/hotels/lib/hotel-path"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { ApiError } from "@/lib/axios"
import type { Hotel, Room } from "@/features/hotels/types"

export default function HotelDetailsPage() {
  // URL is /hotels/:slug (old links with the MongoDB id still work and are redirected to the slug)
  const { slug = "" } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)

  const [roomId, setRoomId] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [numberOfRooms, setNumberOfRooms] = useState(1)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [bookingError, setBookingError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    hotelApi
      .get(slug)
      .then(({ hotel, rooms }) => {
        setHotel(hotel)
        setRooms(rooms)
        if (rooms[0]) setRoomId(rooms[0]._id)
        // Old id-based link -> show the SEO slug in the address bar
        if (isObjectId(slug) && hotel.slug && hotel.slug !== slug) {
          navigate(hotelPath(hotel), { replace: true })
        }
      })
      .catch(() => setHotel(null))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  if (loading) return <PageLoader label="Loading hotel..." />
  if (!hotel) return (
    <main className="min-h-screen pt-32 pb-20 text-center">
      <p className="text-muted-foreground">Hotel not found.</p>
    </main>
  )

  const selectedRoom = rooms.find((r) => r._id === roomId)
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const totalEstimate = selectedRoom && nights ? selectedRoom.price * nights * numberOfRooms : 0

  // Hotels are a REQUEST: nothing is paid now. Our team confirms price + availability with the hotel first.
  const handleRequest = async () => {
    setBookingError("")
    if (!user) {
      navigate("/login")
      return
    }
    if (!roomId || !checkIn || !checkOut) {
      setBookingError("Please select a room and your check-in/check-out dates")
      return
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      setBookingError("Check-out must be after check-in")
      return
    }

    setSubmitting(true)
    try {
      const { booking } = await bookingApi.create({
        bookingType: "hotel",
        hotelId: hotel._id,
        roomId,
        checkIn,
        checkOut,
        numberOfRooms,
        guests: { adults, children },
      })
      navigate(`/bookings/${booking._id}?requested=1`)
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Could not send your request")
    } finally {
      setSubmitting(false)
    }
  }

  const images = hotel.images.length ? hotel.images : []

  return (
    <main className="min-h-screen pt-24 pb-20 bg-background">
      <PageMeta
        title={`${hotel.name} - ${hotel.location.city}${hotel.location.state ? `, ${hotel.location.state}` : ""} | Incredible India Travel`}
        description={hotel.description.replace(/\s+/g, " ").trim().slice(0, 155)}
        canonical={hotelPath(hotel)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Gallery */}
        <div className="mb-8">
          <div className="relative aspect-[16/8] overflow-hidden rounded-2xl bg-muted">
            {images[activeImage] ? (
              <img loading="lazy" decoding="async" src={images[activeImage].url} alt={hotel.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
            )}
            <div className="absolute right-4 top-4">
              <WishlistButton itemType="Hotel" itemId={hotel._id} />
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
          {/* Left column */}
          <div className="lg:col-span-2">
            <Badge className="mb-3 bg-primary/10 text-primary">{hotel.hotelType}</Badge>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{hotel.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" /> {hotel.location.address}, {hotel.location.city}, {hotel.location.state}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <StarRating rating={hotel.rating} size="md" />
              <span className="text-sm text-muted-foreground">{hotel.rating.toFixed(1)} ({hotel.numReviews} reviews)</span>
            </div>

            <p className="mt-6 leading-relaxed text-foreground/90">{hotel.description}</p>

            {hotel.amenities.length > 0 && (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-4">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {hotel.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm text-foreground/90">
                      <Check className="size-4 text-primary" /> {a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <h2 className="font-serif text-xl font-bold text-foreground mb-4">Rooms</h2>
              <div className="space-y-3">
                {rooms.map((room) => (
                  <Card key={room._id} className={`p-4 flex items-center justify-between gap-4 ${roomId === room._id ? "border-primary" : ""}`}>
                    <div className="flex items-center gap-3">
                      <BedDouble className="size-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{room.roomType} Room</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="size-3" /> Up to {room.capacity} guests</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatINR(room.price)}<span className="text-xs text-muted-foreground font-normal"> /night</span></p>
                      <Button
                        size="sm"
                        variant={roomId === room._id ? "default" : "outline"}
                        className={roomId === room._id ? "mt-1 bg-primary text-primary-foreground hover:bg-primary/90" : "mt-1"}
                        onClick={() => setRoomId(room._id)}
                      >
                        {roomId === room._id ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {hotel.location.coordinates?.lat && (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-4">Location</h2>
                <MapEmbed lat={hotel.location.coordinates.lat} lng={hotel.location.coordinates.lng} label={hotel.name} />
              </div>
            )}

            <div className="mt-10">
              <ReviewSection targetType="hotel" targetId={hotel._id} />
            </div>
          </div>

          {/* Booking widget */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28 p-5">
              <h3 className="font-serif text-xl font-bold text-foreground">Request Your Stay</h3>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">No payment now. We confirm price and availability with the hotel, then you approve the final price.</p>

              {bookingError && <Alert variant="destructive" className="mb-4">{bookingError}</Alert>}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Room Type</label>
                  <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>{r.roomType} - {formatINR(r.price)}/night</option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Check-in</label>
                    <input type="date" value={checkIn} min={new Date().toISOString().split("T")[0]} onChange={(e) => setCheckIn(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Check-out</label>
                    <input type="date" value={checkOut} min={checkIn || new Date().toISOString().split("T")[0]} onChange={(e) => setCheckOut(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Rooms</label>
                    <Select value={numberOfRooms} onChange={(e) => setNumberOfRooms(Number(e.target.value))}>
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Adults</label>
                    <Select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Children</label>
                    <Select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                      {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                </div>

                {nights > 0 && selectedRoom && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{formatINR(selectedRoom.price)} x {nights} night{nights > 1 ? "s" : ""} x {numberOfRooms} room{numberOfRooms > 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-1 flex justify-between font-semibold text-foreground">
                      <span>Estimated price</span>
                      <span>{formatINR(totalEstimate)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Estimate only. The final price (with taxes) is confirmed by our team after speaking to the hotel.</p>
                  </div>
                )}

                <Button onClick={handleRequest} disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-5">
                  {submitting ? "Sending request..." : user ? "Request Booking" : "Log in to Request"}
                </Button>

                <ol className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                  <li>1. You send a request (free)</li>
                  <li>2. We confirm price &amp; availability with the hotel</li>
                  <li>3. You approve the final price, then pay to confirm</li>
                </ol>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
