import { useEffect, useRef, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { Tag, ShieldCheck, Timer } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { formatDate, formatINR } from "@/lib/utils"
import { loadRazorpayScript } from "@/features/payments/api/razorpay"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { paymentApi, type RazorpayResponse } from "@/features/payments/api/payment.api"
import { formatCountdown, useCountdown } from "@/features/payments/hooks/useCountdown"
import { ApiError } from "@/lib/axios"
import type { Booking } from "@/features/bookings/types"
import type { Hotel, Room } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

interface RazorpayInstance {
  open: () => void
  on: (event: string, cb: (res: { error?: { description?: string; reason?: string } }) => void) => void
}

export default function CheckoutPage() {
  const { bookingId = "" } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [couponCode, setCouponCode] = useState("")
  const [couponMsg, setCouponMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")
  const [processing, setProcessing] = useState(false)
  const currentOrder = useRef<string | null>(null)

  const secondsLeft = useCountdown(booking?.expiresAt)
  const holdExpired = secondsLeft === 0

  useEffect(() => {
    bookingApi
      .get(bookingId)
      .then(({ booking }) => setBooking(booking))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false))
  }, [bookingId])

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setApplyingCoupon(true)
    setCouponMsg(null)
    try {
      const { booking } = await bookingApi.applyCoupon(bookingId, couponCode.trim())
      setBooking((prev) => (prev ? { ...prev, ...booking } : booking))
      setCouponMsg({ text: booking.pricing.discount > 0 ? `Coupon applied! You saved ${formatINR(booking.pricing.discount)}` : "Coupon applied" })
    } catch (err) {
      setCouponMsg({ text: err instanceof ApiError ? err.message : "Could not apply coupon", error: true })
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handlePay = async () => {
    if (!booking) return
    setPayError("")
    setPaying(true)
    try {
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) throw new Error("Could not load the payment gateway. Please check your connection.")

      const order = await paymentApi.createRazorpayOrder(booking._id)
      currentOrder.current = order.orderId

      const Razorpay = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => RazorpayInstance }).Razorpay
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "India Travel",
        description: `Booking ${booking.bookingReference}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#1a5f4a" },
        // Called by Razorpay after the customer pays. NEVER treated as proof of payment - the server verifies it.
        handler: async (response: RazorpayResponse) => {
          setProcessing(true)
          try {
            await paymentApi.verifyRazorpay(response)
            navigate(`/payment-success/${booking._id}`)
          } catch (err) {
            // 409 = captured later / still processing; the webhook + reconciliation job will confirm it automatically
            if (err instanceof ApiError && err.status === 409) {
              navigate(`/payment-success/${booking._id}`)
              return
            }
            setPayError(err instanceof ApiError ? err.message : "We could not verify your payment. If money was deducted it will be refunded or the booking confirmed automatically.")
            setPaying(false)
            setProcessing(false)
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      })
      rzp.on("payment.failed", (res) => {
        const reason = res.error?.description || "Payment failed"
        setPayError(`${reason}. You can try again.`)
        setPaying(false)
        if (currentOrder.current) paymentApi.reportFailure(currentOrder.current, reason).catch(() => {})
      })
      rzp.open()
    } catch (err) {
      setPayError(err instanceof ApiError || err instanceof Error ? err.message : "Could not start payment")
      setPaying(false)
    }
  }

  if (loading) return <PageLoader label="Loading your booking..." />
  if (!booking) return <p className="py-32 text-center text-muted-foreground">Booking not found.</p>

  // An already-paid booking should not show the checkout form.
  if (booking.paymentStatus === "paid") return <Navigate to={`/payment-success/${booking._id}`} replace />

  // Hotel requests can only be paid after the hotel confirmed the price AND the customer approved it.
  if (booking.bookingStatus === "pending_confirmation" || booking.bookingStatus === "awaiting_approval") {
    return <Navigate to={`/bookings/${booking._id}`} replace />
  }

  if (booking.bookingStatus !== "pending" || holdExpired) {
    return (
      <main className="min-h-screen bg-muted/30 pb-20 pt-28">
        <div className="mx-auto max-w-md px-4">
          <Card className="p-8 text-center">
            <Timer className="mx-auto mb-3 size-10 text-muted-foreground" />
            <h1 className="font-serif text-xl font-bold text-foreground">
              {booking.bookingStatus === "pending" || booking.bookingStatus === "expired" ? "This booking has expired" : `This booking is ${booking.bookingStatus}`}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Unpaid bookings are held for a short time only. Your seats were released - you can search again and rebook.</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button render={<Link to="/packages" />} className="bg-primary text-primary-foreground hover:bg-primary/90">Browse packages</Button>
              <Button variant="outline" render={<Link to="/bookings" />}>My bookings</Button>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  const hotel = typeof booking.hotel === "object" ? (booking.hotel as Hotel) : null
  const room = typeof booking.room === "object" ? (booking.room as Room) : null
  const pkg = typeof booking.package === "object" ? (booking.package as TourPackage) : null

  return (
    <main className="min-h-screen bg-muted/30 pb-20 pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">Checkout</h1>
        <p className="mb-6 text-sm text-muted-foreground">Booking {booking.bookingReference}</p>

        {secondsLeft !== null && (
          <Alert variant={secondsLeft < 300 ? "destructive" : "default"} className="mb-6">
            <Timer className="mt-0.5 size-4 shrink-0" />
            <span>
              Your seats are held for <strong className="tabular-nums">{formatCountdown(secondsLeft)}</strong>. Complete the payment before the timer ends.
            </span>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          <Card className="p-6 md:col-span-3">
            <h2 className="mb-4 font-semibold text-foreground">Booking Summary</h2>
            {booking.bookingType === "hotel" ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{hotel?.name || "Hotel"}</p>
                {room && <p className="text-muted-foreground">{room.roomType} Room × {booking.numberOfRooms}</p>}
                <p className="text-muted-foreground">Check-in: {booking.checkIn && formatDate(booking.checkIn)}</p>
                <p className="text-muted-foreground">Check-out: {booking.checkOut && formatDate(booking.checkOut)}</p>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{pkg?.name || "Tour Package"}</p>
                <p className="text-muted-foreground">Travel date: {booking.travelDate && formatDate(booking.travelDate)}</p>
              </div>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Guests: {booking.guests.adults} adult{booking.guests.adults > 1 ? "s" : ""}
              {booking.guests.children > 0 && `, ${booking.guests.children} children`}
            </p>

            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Tag className="size-4" /> Have a coupon?</h3>
              <div className="flex gap-2">
                <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder={booking.couponCode ? `Applied: ${booking.couponCode}` : "e.g. WELCOME10"} />
                <Button variant="outline" onClick={applyCoupon} disabled={applyingCoupon || paying}>
                  {applyingCoupon ? "Applying..." : "Apply"}
                </Button>
              </div>
              {couponMsg && <p className={`mt-2 text-xs ${couponMsg.error ? "text-destructive" : "text-primary"}`}>{couponMsg.text}</p>}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Cancellation policy: 90% refund 7+ days before the trip, 50% for 3-6 days, no refund inside 3 days.
            </p>
          </Card>

          <Card className="h-fit p-6 md:col-span-2">
            <h2 className="mb-4 font-semibold text-foreground">Price Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Base price</span><span>{formatINR(booking.pricing.basePrice)}</span></div>
              {booking.pricing.discount > 0 && (
                <div className="flex justify-between text-primary"><span>Discount{booking.couponCode ? ` (${booking.couponCode})` : ""}</span><span>-{formatINR(booking.pricing.discount)}</span></div>
              )}
              <div className="flex justify-between text-muted-foreground"><span>Taxes</span><span>{formatINR(booking.pricing.tax)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                <span>Total</span><span>{formatINR(booking.pricing.totalAmount)}</span>
              </div>
            </div>

            {payError && <Alert variant="destructive" className="mt-4">{payError}</Alert>}
            {processing && <Alert className="mt-4">Confirming your payment with the bank...</Alert>}

            <Button onClick={handlePay} disabled={paying || processing} className="mt-6 w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">
              {processing ? "Verifying..." : paying ? "Processing..." : `Pay ${formatINR(booking.pricing.totalAmount)}`}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Secured by Razorpay
            </p>
          </Card>
        </div>
      </div>
    </main>
  )
}
