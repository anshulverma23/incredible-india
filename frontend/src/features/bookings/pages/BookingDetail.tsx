import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Download, X, MapPin, Calendar, Printer, CheckCircle2, MessageCircle, Star, HelpCircle, Timer, Hourglass, BadgeIndianRupee } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { useToast } from "@/hooks/useToast"
import { formatDate, formatINR } from "@/lib/utils"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLES, PAYMENT_STATUS_LABEL, canApprovePrice, isPayable } from "@/features/bookings/lib/status"
import { ApiError } from "@/lib/axios"
import type { Booking, BookingStatus, RefundPreview } from "@/features/bookings/types"
import type { Hotel, Room } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

type Step = { status: BookingStatus; label: string }

// Packages are paid straight away; hotels are a request that the hotel + customer confirm first.
const PACKAGE_STEPS: Step[] = [
  { status: "pending", label: "booked" },
  { status: "confirmed", label: "confirmed" },
  { status: "completed", label: "completed" },
]
const HOTEL_STEPS: Step[] = [
  { status: "pending_confirmation", label: "requested" },
  { status: "awaiting_approval", label: "price ready" },
  { status: "pending", label: "approved" },
  { status: "confirmed", label: "confirmed" },
  { status: "completed", label: "completed" },
]
const TERMINAL: BookingStatus[] = ["cancelled", "refunded", "failed", "expired", "declined"]

function BookingStepper({ booking }: { booking: Booking }) {
  const { bookingStatus: status } = booking
  const steps = booking.bookingType === "hotel" ? HOTEL_STEPS : PACKAGE_STEPS

  if (TERMINAL.includes(status)) {
    const refunded = booking.cancellation?.refundAmount
    const reason = status === "declined" ? booking.declineReason : booking.cancellation?.reason
    return (
      <div className="mt-6 flex flex-col items-center justify-center gap-1 rounded-xl bg-destructive/10 p-4 text-center text-destructive">
        <span className="flex items-center gap-2 font-semibold"><X className="size-5" /> {BOOKING_STATUS_LABEL[status]}</span>
        {status === "declined" && <span className="text-sm">The hotel could not confirm this stay. You have not been charged.</span>}
        {refunded ? <span className="text-sm">Refund of {formatINR(refunded)} initiated - it reaches your account in 5-7 business days.</span> : null}
        {reason && <span className="text-xs opacity-80">Reason: {reason}</span>}
      </div>
    )
  }

  const currentIndex = Math.max(0, steps.findIndex((st) => st.status === status))
  return (
    <div className="relative mb-6 mt-8">
      <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }} />
      </div>
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isActive = index <= currentIndex
          return (
            <div key={step.status} className="flex flex-col items-center gap-2 bg-card px-2">
              <div className={`flex size-8 items-center justify-center rounded-full border-2 transition-colors ${isActive ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 bg-muted text-muted-foreground"}`}>
                {isActive ? <CheckCircle2 className="size-5" /> : <div className="size-2.5 rounded-full bg-current opacity-50" />}
              </div>
              <span className={`text-center text-[10px] font-medium uppercase tracking-wider sm:text-xs ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const justRequested = searchParams.get("requested") === "1"
  const { toast } = useToast()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [refundPreview, setRefundPreview] = useState<RefundPreview | undefined>()
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [approving, setApproving] = useState(false)

  const load = () =>
    bookingApi
      .get(id)
      .then(({ booking, refundPreview }) => {
        setBooking(booking)
        setRefundPreview(refundPreview)
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Customer accepts the final price -> booking becomes "awaiting payment" and we go to checkout.
  const handleApprove = async () => {
    setApproving(true)
    try {
      await bookingApi.approve(id)
      toast("Price approved. Please complete the payment.")
      navigate(`/checkout/${id}`)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not approve the price", "error")
      await load()
    } finally {
      setApproving(false)
    }
  }

  const handleCancel = async () => {
    if (!booking) return
    const policy = refundPreview?.paid
      ? refundPreview.refundAmount > 0
        ? `You will be refunded ${formatINR(refundPreview.refundAmount)} (${refundPreview.refundPercent}% of what you paid) under the cancellation policy.`
        : "No refund applies at this point under the cancellation policy."
      : "You have not paid yet, so nothing will be charged."
    const isRequest = booking.bookingStatus === "pending_confirmation" || booking.bookingStatus === "awaiting_approval"
    if (!confirm(`${isRequest ? "Cancel this request" : "Cancel booking"} ${booking.bookingReference}?\n\n${policy}\n\nThis cannot be undone.`)) return

    setCancelling(true)
    try {
      const { refund } = await bookingApi.cancel(id)
      toast(refund.amount > 0 ? `Booking cancelled. ${formatINR(refund.amount)} will be refunded.` : "Booking cancelled")
      await load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not cancel booking", "error")
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader label="Loading booking..." />
  if (!booking) return <p className="py-32 text-center text-muted-foreground">Booking not found.</p>

  const hotel = typeof booking.hotel === "object" ? (booking.hotel as Hotel) : null
  const room = typeof booking.room === "object" ? (booking.room as Room) : null
  const pkg = typeof booking.package === "object" ? (booking.package as TourPackage) : null
  const isRequestStage = booking.bookingStatus === "pending_confirmation" || booking.bookingStatus === "awaiting_approval"
  const canCancel = isRequestStage || booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed"
  const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "")
  const hasInvoice = ["paid", "partially_refunded", "refunded"].includes(booking.paymentStatus)

  return (
    <main className="min-h-screen bg-muted/20 pb-20 pt-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link to="/bookings" className="text-sm text-muted-foreground hover:text-primary">&larr; Back to bookings</Link>

        <Card className="mt-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">{booking.bookingType === "hotel" ? hotel?.name : pkg?.name}</h1>
              <p className="text-sm text-muted-foreground">Booking ID {booking.bookingReference}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={BOOKING_STATUS_STYLES[booking.bookingStatus]}>{BOOKING_STATUS_LABEL[booking.bookingStatus]}</Badge>
              <Badge variant="outline" className="bg-background">{PAYMENT_STATUS_LABEL[booking.paymentStatus]}</Badge>
            </div>
          </div>

          {justRequested && booking.bookingStatus === "pending_confirmation" && (
            <Alert className="mt-4 border-primary/30 bg-primary/5 text-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Request sent! You do not need to pay anything yet.
            </Alert>
          )}

          {booking.bookingStatus === "pending_confirmation" && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="flex items-center gap-2 font-semibold"><Hourglass className="size-4" /> Pending confirmation</p>
              <p className="mt-1">
                Our team is checking price and availability with the hotel. We will email you and send a notification with the final price
                {booking.expiresAt ? ` (we aim to reply before ${fmtDateTime(booking.expiresAt)})` : ""}. After that you can approve it and pay.
              </p>
            </div>
          )}

          {booking.bookingStatus === "awaiting_approval" && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900/40 dark:bg-sky-950/20">
              <p className="flex items-center gap-2 font-semibold text-sky-900 dark:text-sky-200"><BadgeIndianRupee className="size-4" /> The hotel confirmed - your final price is ready</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{formatINR(booking.pricing.totalAmount)} <span className="text-xs font-normal text-muted-foreground">incl. taxes</span></p>
              {booking.quote?.note && <p className="mt-2 whitespace-pre-wrap text-foreground/90">{booking.quote.note}</p>}
              {booking.expiresAt && (
                <p className={`mt-2 text-xs ${canApprovePrice(booking) ? "text-muted-foreground" : "text-destructive"}`}>
                  {canApprovePrice(booking) ? `Rooms are reserved for you until ${fmtDateTime(booking.expiresAt)}.` : "This price offer has expired."}
                </p>
              )}
              {canApprovePrice(booking) && (
                <Button onClick={handleApprove} disabled={approving} className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                  {approving ? "Approving..." : "Approve price & continue to payment"}
                </Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Nothing is charged until you approve and pay. Not happy with the price? Use &ldquo;Cancel request&rdquo; below.</p>
            </div>
          )}

          {isPayable(booking) && (
            <Alert variant="destructive" className="mt-4">
              <Timer className="mt-0.5 size-4 shrink-0" /> Payment pending. Your seats are held until {booking.expiresAt && new Date(booking.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
            </Alert>
          )}

          <BookingStepper booking={booking} />

          <div className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {booking.bookingType === "hotel" ? (
              <>
                <div className="flex items-center gap-2 text-foreground/90"><MapPin className="size-4 text-primary" /> {hotel?.location.city}, {hotel?.location.state}</div>
                <div className="flex items-center gap-2 text-foreground/90"><Calendar className="size-4 text-primary" /> {booking.checkIn && formatDate(booking.checkIn)} - {booking.checkOut && formatDate(booking.checkOut)}</div>
                {room && <div className="text-foreground/90">Room: {room.roomType} × {booking.numberOfRooms}</div>}
              </>
            ) : (
              <div className="flex items-center gap-2 text-foreground/90"><Calendar className="size-4 text-primary" /> Travel date: {booking.travelDate && formatDate(booking.travelDate)}</div>
            )}
            <div className="text-foreground/90">
              Guests: {booking.guests.adults} adult{booking.guests.adults > 1 ? "s" : ""}
              {booking.guests.children > 0 && `, ${booking.guests.children} children`}
            </div>
          </div>

          {booking.bookingStatus === "pending_confirmation" ? (
            <div className="mt-6 rounded-lg bg-muted p-4 text-sm">
              <div className="flex justify-between font-semibold text-foreground"><span>Estimated price (before taxes)</span><span>{formatINR(booking.estimatedBasePrice ?? booking.pricing.basePrice)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">This is only an estimate. The final price including taxes is confirmed with the hotel and sent to you for approval.</p>
            </div>
          ) : (
          <div className="mt-6 rounded-lg bg-muted p-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Base price</span><span>{formatINR(booking.pricing.basePrice)}</span></div>
            {booking.pricing.discount > 0 && <div className="flex justify-between text-primary"><span>Discount{booking.couponCode ? ` (${booking.couponCode})` : ""}</span><span>-{formatINR(booking.pricing.discount)}</span></div>}
            <div className="flex justify-between text-muted-foreground"><span>Taxes</span><span>{formatINR(booking.pricing.tax)}</span></div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground"><span>{booking.bookingStatus === "awaiting_approval" ? "Final price" : "Total"}</span><span>{formatINR(booking.pricing.totalAmount)}</span></div>
          </div>
          )}

          {refundPreview?.paid && booking.bookingStatus === "confirmed" && (
            <p className="mt-3 text-xs text-muted-foreground">
              If you cancel now you get back {formatINR(refundPreview.refundAmount)} ({refundPreview.refundPercent}%).
              {refundPreview.refundPercent < 90 && " The refund drops the closer you get to the trip."}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {hasInvoice && (
              <Button variant="outline" onClick={() => bookingApi.downloadInvoice(booking._id, booking.invoiceNumber)}>
                <Download className="mr-2 size-4" /> Download Invoice
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" /> Print Summary</Button>
            {canCancel && (
              <Button variant="outline" onClick={handleCancel} disabled={cancelling} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <X className="mr-2 size-4" /> {cancelling ? "Cancelling..." : isRequestStage ? "Cancel request" : "Cancel Booking"}
              </Button>
            )}
            {isPayable(booking) && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link to={`/checkout/${booking._id}`} />}>Complete Payment</Button>
            )}
          </div>
        </Card>

        {booking.statusHistory && booking.statusHistory.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="mb-3 font-semibold text-foreground">Booking history</h2>
            <ol className="space-y-2 border-l border-border pl-4 text-sm">
              {booking.statusHistory.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                  <span className="font-medium text-foreground">{BOOKING_STATUS_LABEL[h.status] ?? h.status}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-primary/10 bg-primary/5 p-6 transition-colors hover:border-primary/20">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary"><HelpCircle className="size-6" /></div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Need help with this booking?</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">Quote booking ID {booking.bookingReference} when contacting us for faster support.</p>
                <Button variant="outline" className="w-full sm:w-auto" render={<Link to={`/contact?ref=${booking.bookingReference}`} />}>
                  <MessageCircle className="mr-2 size-4" /> Contact Support
                </Button>
              </div>
            </div>
          </Card>

          {booking.bookingStatus === "completed" && (
            <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-6 transition-colors hover:border-amber-200 dark:border-amber-900/30 dark:from-amber-950/20 dark:to-orange-950/20">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"><Star className="size-6 fill-amber-500" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">How was your trip?</h3>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">Your booking is complete, so you can now leave a verified review.</p>
                  <Button className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto" render={<Link to={`/${booking.bookingType}s/${booking.bookingType === "hotel" ? hotel?.slug || hotel?._id : pkg?.slug || pkg?._id}#reviews`} />}>
                    Write a Review
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
