import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { PageLoader } from "@/components/ui/spinner"
import { formatDate, formatINR } from "@/lib/utils"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLES, PAYMENT_STATUS_LABEL, isPayable } from "@/features/bookings/lib/status"
import type { Booking } from "@/features/bookings/types"

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    let ignore = false
    bookingApi
      .my({ status: filter })
      .then(({ bookings }) => !ignore && setBookings(bookings))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [filter])

  return (
    <main className="min-h-screen bg-muted/20 pb-20 pt-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold text-foreground">My Bookings</h1>
          <div className="w-48">
            <Select value={filter} onChange={(e) => { setLoading(true); setFilter(e.target.value) }}>
              <option value="">All statuses</option>
              <option value="pending">Awaiting payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="expired">Expired</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <PageLoader label="Loading your bookings..." />
        ) : bookings.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No bookings here yet. <Link to="/packages" className="text-primary underline">Find your next trip</Link>.
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const title =
                b.bookingType === "hotel"
                  ? typeof b.hotel === "object" ? b.hotel?.name : "Hotel booking"
                  : typeof b.package === "object" ? b.package?.name : "Package booking"
              const when = b.bookingType === "hotel" ? b.checkIn : b.travelDate
              return (
                <Card key={b._id} className="flex flex-col justify-between gap-3 p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center">
                  <Link to={`/bookings/${b._id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.bookingReference} · {b.bookingType === "hotel" ? "Hotel" : "Package"}
                      {when ? ` · ${formatDate(when)}` : ""} · Booked {formatDate(b.createdAt)}
                    </p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-sm font-semibold text-foreground">{formatINR(b.pricing.totalAmount)}</span>
                    <Badge className={BOOKING_STATUS_STYLES[b.bookingStatus]}>{BOOKING_STATUS_LABEL[b.bookingStatus]}</Badge>
                    <Badge variant="outline">{PAYMENT_STATUS_LABEL[b.paymentStatus]}</Badge>
                    {isPayable(b) && (
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link to={`/checkout/${b._id}`} />}>
                        Pay now
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
