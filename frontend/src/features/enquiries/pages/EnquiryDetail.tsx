import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CalendarDays, Hourglass, Phone, Users, Wallet } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageLoader } from "@/components/ui/spinner"
import { useToast } from "@/hooks/useToast"
import { cn, formatDate, formatINR } from "@/lib/utils"
import { ApiError } from "@/lib/axios"
import { enquiryApi } from "@/features/enquiries/api/enquiry.api"
import { Conversation } from "@/features/enquiries/components/conversation"
import { QuotationView } from "@/features/enquiries/components/quotation-view"
import { paymentOptions } from "@/features/enquiries/lib/payment-plan"
import { CONTACT_LABEL, CUSTOMER_STATUS_LABEL, ENQUIRY_STATUS_STYLES, budgetLabel, isBookingPayable, isFuture, isOpenEnquiry, packageName, packageSlug } from "@/features/enquiries/lib/status"
import type { PackageEnquiry } from "@/features/enquiries/types"

type Panel = "none" | "revise" | "counter" | "cancel"

/** Customer: one enquiry - request, chat, quotation, and the next step (accept / change / counter-offer / pay). */
export default function EnquiryDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [enquiry, setEnquiry] = useState<PackageEnquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>("none")
  const [payOption, setPayOption] = useState<"full" | "advance">("full")
  const [note, setNote] = useState("")
  const [offer, setOffer] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(
    () =>
      enquiryApi
        .get(id)
        .then(({ enquiry }) => setEnquiry(enquiry))
        .catch(() => setEnquiry(null))
        .finally(() => setLoading(false)),
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  // pick up new replies without a manual refresh
  const status = enquiry?.status
  useEffect(() => {
    if (!status || !isOpenEnquiry(status)) return
    const timer = setInterval(load, 20_000)
    return () => clearInterval(timer)
  }, [status, load])

  const run = async (fn: () => Promise<PackageEnquiry | void>, okMsg?: string) => {
    setBusy(true)
    setError("")
    try {
      const next = await fn()
      if (next) setEnquiry(next)
      if (okMsg) toast(okMsg)
      setPanel("none")
      setNote("")
      setOffer("")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader label="Loading your enquiry..." />
  if (!enquiry) return <p className="py-32 text-center text-muted-foreground">Enquiry not found.</p>

  const q = enquiry.quotation
  const req = enquiry.request
  const plan = q ? paymentOptions(q, req.startDate) : null
  const booking = typeof enquiry.booking === "object" ? enquiry.booking : null
  const bookingPayable = isBookingPayable(booking)
  const canRespond = enquiry.status === "quotation_sent" && !enquiry.quotationExpired
  const canReaccept = enquiry.status === "accepted" && !bookingPayable && Boolean(q) && isFuture(q?.validUntil)
  const chatOpen = !["rejected", "cancelled"].includes(enquiry.status)

  const accept = () => run(async () => {
    const res = await enquiryApi.accept(enquiry._id, payOption)
    navigate(`/checkout/${res.booking._id}`)
  })

  return (
    <main className="min-h-screen bg-muted/30 pb-20 pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link to="/enquiries" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> My enquiries</Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">{packageName(enquiry)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enquiry {enquiry.enquiryNumber} · <Link to={`/packages/${packageSlug(enquiry)}`} className="text-primary hover:underline">View package</Link></p>
          </div>
          <Badge className={ENQUIRY_STATUS_STYLES[enquiry.status]}>{CUSTOMER_STATUS_LABEL[enquiry.status]}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-foreground">Your request</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" /> Travel date</dt><dd className="font-medium">{formatDate(req.startDate)}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" /> Travellers</dt><dd className="font-medium">{req.adults} adult{req.adults > 1 ? "s" : ""}{req.children ? `, ${req.children} child${req.children > 1 ? "ren" : ""}` : ""}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Days · Rooms</dt><dd className="font-medium">{req.days ?? "-"} · {req.rooms ?? 1}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="size-3" /> Budget</dt><dd className="font-medium">{budgetLabel(enquiry, formatINR)}</dd></div>
              </dl>
              {req.requirements && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-muted-foreground">{req.requirements}</p>}
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" /> We will contact you by {CONTACT_LABEL[req.contactMethod].toLowerCase()}{req.phone ? ` (${req.phone})` : ""}</p>
            </Card>

            {q && (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold text-foreground">Your personalised quotation</h2>
                <QuotationView quotation={q} request={req} expired={enquiry.quotationExpired} />
              </Card>
            )}

            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-foreground">Conversation</h2>
              <Conversation
                messages={enquiry.messages}
                viewer="customer"
                canSend={chatOpen}
                onSend={async (text) => {
                  try {
                    const res = await enquiryApi.message(enquiry._id, text)
                    setEnquiry(res.enquiry)
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Could not send your message", "error")
                    throw err
                  }
                }}
              />
            </Card>
          </div>

          {/* Next step */}
          <div className="lg:col-span-1">
            <Card className="p-5 lg:sticky lg:top-28">
              <h2 className="mb-3 font-semibold text-foreground">Next step</h2>
              {error && <Alert variant="destructive" className="mb-3">{error}</Alert>}

              {(enquiry.status === "new" || enquiry.status === "in_discussion") && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground"><Hourglass className="mt-0.5 size-4 shrink-0" /> Our travel expert is reviewing your requirements and will discuss hotels, transport and activities with you. You will get a quotation here and by email. Nothing is charged until you accept it.</p>
              )}
              {enquiry.status === "revision_requested" && <p className="text-sm text-muted-foreground">We received your change request and are updating the quotation. We will notify you.</p>}
              {enquiry.status === "counter_offered" && enquiry.counterOffer && <p className="text-sm text-muted-foreground">Your offer of <strong className="text-foreground">{formatINR(enquiry.counterOffer.amount)}</strong> (before GST) is being reviewed. We will reply soon.</p>}

              {enquiry.status === "quotation_sent" && enquiry.quotationExpired && (
                <Alert variant="destructive">This quotation has expired. Send us a message and we will issue a new one.</Alert>
              )}

              {canRespond && q && plan && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Total <strong className="text-foreground">{formatINR(q.totalAmount)}</strong> incl. GST. Choose how to pay:</p>
                  <div className="space-y-2" role="radiogroup" aria-label="Payment option">
                    <button type="button" role="radio" aria-checked={payOption === "full"} onClick={() => setPayOption("full")} className={cn("w-full rounded-lg border p-3 text-left text-sm transition-colors", payOption === "full" ? "border-primary bg-primary/5" : "border-border")}>
                      <span className="font-semibold text-foreground">Pay in full</span><span className="block text-xs text-muted-foreground">{formatINR(plan.full)} now</span>
                    </button>
                    {enquiry.advanceAvailable && q.advancePercent && (
                      <button type="button" role="radio" aria-checked={payOption === "advance"} onClick={() => setPayOption("advance")} className={cn("w-full rounded-lg border p-3 text-left text-sm transition-colors", payOption === "advance" ? "border-primary bg-primary/5" : "border-border")}>
                        <span className="font-semibold text-foreground">Pay {q.advancePercent}% advance</span>
                        <span className="block text-xs text-muted-foreground">{formatINR(plan.advance)} now, {formatINR(plan.balance)} by {formatDate(plan.balanceDue)}</span>
                      </button>
                    )}
                  </div>
                  <Button onClick={accept} disabled={busy} className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">{busy ? "Please wait..." : "Accept & continue to payment"}</Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setPanel(panel === "revise" ? "none" : "revise")}>Ask for changes</Button>
                    <Button variant="outline" onClick={() => setPanel(panel === "counter" ? "none" : "counter")}>Counter-offer</Button>
                  </div>

                  {panel === "revise" && (
                    <div className="space-y-2">
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What should we change? e.g. add a desert safari, 4-star hotels..." />
                      <Button disabled={busy || note.trim().length < 3} onClick={() => run(async () => (await enquiryApi.requestRevision(enquiry._id, note.trim())).enquiry, "Change request sent")} className="w-full">Send change request</Button>
                    </div>
                  )}
                  {panel === "counter" && (
                    <div className="space-y-2">
                      <label htmlFor="offer" className="block text-xs text-muted-foreground">Your offer for the package, before GST (quoted {formatINR(q.amount)})</label>
                      <Input id="offer" type="number" min={1} max={q.amount - 1} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={String(Math.round(q.amount * 0.9))} />
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Reason (optional)" />
                      <Button disabled={busy || !(Number(offer) > 0 && Number(offer) < q.amount)} onClick={() => run(async () => (await enquiryApi.counterOffer(enquiry._id, Number(offer), note.trim() || undefined)).enquiry, "Your offer was sent")} className="w-full">Send offer</Button>
                    </div>
                  )}
                </div>
              )}

              {enquiry.status === "accepted" && (
                <div className="space-y-3 text-sm">
                  {bookingPayable && booking ? (
                    <>
                      <p className="text-muted-foreground">Quotation accepted. Complete the {enquiry.paymentOption === "advance" ? "advance " : ""}payment to confirm your booking {booking.bookingReference}.</p>
                      <Button render={<Link to={`/checkout/${booking._id}`} />} className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">Pay now</Button>
                    </>
                  ) : canReaccept ? (
                    <>
                      <p className="text-muted-foreground">The payment window ended. Your quotation is still valid, so you can continue.</p>
                      <Button onClick={accept} disabled={busy} className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">Continue to payment</Button>
                    </>
                  ) : (
                    <Alert variant="destructive">The payment window ended and the quotation has expired. Send us a message for a new one.</Alert>
                  )}
                </div>
              )}

              {enquiry.status === "booked" && booking && (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">Your booking <strong className="text-foreground">{booking.bookingReference}</strong> is confirmed{booking.paymentStatus === "partially_paid" ? ". The balance is still due before your trip." : "."}</p>
                  <Button render={<Link to={`/bookings/${booking._id}`} />} className="w-full">View booking</Button>
                </div>
              )}

              {enquiry.status === "rejected" && <p className="text-sm text-muted-foreground">We could not take this enquiry forward. You have not been charged. See the conversation for details.</p>}
              {enquiry.status === "cancelled" && <p className="text-sm text-muted-foreground">This enquiry was cancelled.</p>}

              {isOpenEnquiry(enquiry.status) && enquiry.status !== "accepted" && (
                <div className="mt-4 border-t border-border pt-3">
                  {panel === "cancel" ? (
                    <div className="space-y-2">
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Reason (optional)" />
                      <div className="flex gap-2">
                        <Button variant="destructive" disabled={busy} onClick={() => run(async () => (await enquiryApi.cancel(enquiry._id, note.trim() || undefined)).enquiry, "Enquiry cancelled")} className="flex-1">Cancel enquiry</Button>
                        <Button variant="outline" onClick={() => setPanel("none")}>Keep</Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPanel("cancel")} className="text-xs text-muted-foreground underline hover:text-destructive">Cancel this enquiry</button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}