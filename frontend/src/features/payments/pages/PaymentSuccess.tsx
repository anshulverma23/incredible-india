import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CheckCircle2, Download, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/spinner"
import { formatINR } from "@/lib/utils"
import { bookingApi } from "@/features/bookings/api/booking.api"
import type { Booking } from "@/features/bookings/types"

const MAX_POLLS = 12 // ~36s: the webhook / reconciliation normally confirms well within this

export default function PaymentSuccessPage() {
  const { bookingId = "" } = useParams<{ bookingId: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [polls, setPolls] = useState(0)

  const confirmed = booking?.paymentStatus === "paid"

  // The customer may land here a moment before the server has confirmed the payment (webhook race) - keep checking.
  useEffect(() => {
    if (confirmed || polls >= MAX_POLLS) return
    let cancelled = false
    const id = setTimeout(
      () => {
        bookingApi
          .get(bookingId)
          .then(({ booking }) => !cancelled && setBooking(booking))
          .catch(() => {})
          .finally(() => {
            if (cancelled) return
            setLoading(false)
            setPolls((p) => p + 1)
          })
      },
      polls === 0 ? 0 : 3000,
    )
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [bookingId, confirmed, polls])

  if (loading) return <PageLoader />

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 pb-20 pt-28">
      <Card className="w-full max-w-md p-8 text-center">
        {confirmed ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 size-14 text-primary" />
            <h1 className="font-serif text-2xl font-bold text-foreground">Booking Confirmed!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your payment was successful. Your invoice and confirmation are on their way to your email.</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 size-14 animate-spin text-primary" />
            <h1 className="font-serif text-2xl font-bold text-foreground">Confirming your payment...</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {polls >= MAX_POLLS
                ? "This is taking longer than usual. Please don't pay again - we'll confirm automatically and email you. If money was deducted and the booking can't be confirmed, it is refunded."
                : "Waiting for the bank to confirm. This usually takes a few seconds."}
            </p>
          </>
        )}

        {booking && (
          <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Booking ID</span><span className="font-medium">{booking.bookingReference}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{confirmed ? "Amount Paid" : "Amount"}</span><span className="font-medium">{formatINR(booking.pricing.totalAmount)}</span></div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {booking && confirmed && (
            <Button variant="outline" onClick={() => bookingApi.downloadInvoice(booking._id, booking.invoiceNumber)}>
              <Download className="mr-2 size-4" /> Download Invoice
            </Button>
          )}
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link to={booking ? `/bookings/${booking._id}` : "/bookings"} />}>
            View Booking
          </Button>
        </div>
      </Card>
    </main>
  )
}
