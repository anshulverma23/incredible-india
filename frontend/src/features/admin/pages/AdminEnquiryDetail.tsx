import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageLoader } from "@/components/ui/spinner"
import { useToast } from "@/hooks/useToast"
import { formatDate, formatINR } from "@/lib/utils"
import { ApiError } from "@/lib/axios"
import { enquiryApi } from "@/features/enquiries/api/enquiry.api"
import { Conversation } from "@/features/enquiries/components/conversation"
import { QuotationBuilder } from "@/features/enquiries/components/quotation-builder"
import { QuotationView } from "@/features/enquiries/components/quotation-view"
import { CONTACT_LABEL, ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLES, budgetLabel, packageName } from "@/features/enquiries/lib/status"
import type { PackageEnquiry, QuotationInput } from "@/features/enquiries/types"

/** Admin: work one enquiry - read the requirements, talk to the customer, price + customise, answer counter-offers. */
export default function AdminEnquiryDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [enquiry, setEnquiry] = useState<PackageEnquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [showBuilder, setShowBuilder] = useState(false)
  const [counterNote, setCounterNote] = useState("")
  const [closeReason, setCloseReason] = useState("")
  const [showClose, setShowClose] = useState(false)
  const [noteText, setNoteText] = useState("")

  const load = useCallback(
    () =>
      enquiryApi
        .adminGet(id)
        .then(({ enquiry }) => setEnquiry(enquiry))
        .catch(() => setEnquiry(null))
        .finally(() => setLoading(false)),
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  const run = async (key: string, fn: () => Promise<{ enquiry: PackageEnquiry } | void>, okMsg: string) => {
    setBusy(key)
    try {
      const res = await fn()
      if (res) setEnquiry((prev) => (prev ? { ...res.enquiry, adminNotes: prev.adminNotes } : res.enquiry))
      toast(okMsg)
      return true
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong", "error")
      return false
    } finally {
      setBusy("")
    }
  }

  if (loading) return <PageLoader label="Loading enquiry..." />
  if (!enquiry) return <p className="py-20 text-center text-muted-foreground">Enquiry not found.</p>

  const customer = typeof enquiry.user === "object" ? enquiry.user : null
  const phone = enquiry.request.phone || customer?.phone
  const req = enquiry.request
  const booking = typeof enquiry.booking === "object" ? enquiry.booking : null
  const counter = enquiry.status === "counter_offered" && enquiry.counterOffer?.status === "pending" ? enquiry.counterOffer : null
  const canQuote = ["new", "in_discussion", "revision_requested", "counter_offered", "quotation_sent"].includes(enquiry.status)
  const chatOpen = !["rejected", "cancelled"].includes(enquiry.status)
  const canClose = !["booked", "rejected", "cancelled"].includes(enquiry.status)
  const canReopen = ["rejected", "cancelled"].includes(enquiry.status)

  return (
    <div>
      <Link to="/admin/enquiries" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> All enquiries</Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">{packageName(enquiry)}</h1>
          <p className="text-sm text-muted-foreground">{enquiry.enquiryNumber} · received {formatDate(enquiry.createdAt)}</p>
        </div>
        <Badge className={ENQUIRY_STATUS_STYLES[enquiry.status]}>{ENQUIRY_STATUS_LABEL[enquiry.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-foreground">Customer requirements</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">Travel start</dt><dd className="font-medium">{formatDate(req.startDate)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Travellers</dt><dd className="font-medium">{req.adults} adult{req.adults > 1 ? "s" : ""}{req.children ? `, ${req.children} child${req.children > 1 ? "ren" : ""}` : ""}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Days · Rooms</dt><dd className="font-medium">{req.days ?? "-"} · {req.rooms ?? 1}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Budget</dt><dd className="font-medium">{budgetLabel(enquiry, formatINR)}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Prefers</dt><dd className="font-medium">{CONTACT_LABEL[req.contactMethod]}</dd></div>
            </dl>
            {req.requirements ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{req.requirements}</p> : <p className="mt-3 text-sm text-muted-foreground">No special requirements written.</p>}
          </Card>

          {counter && (
            <Card className="border-pink-300 bg-pink-50/60 p-5 dark:bg-pink-950/20">
              <h2 className="mb-1 font-semibold text-foreground">Customer counter-offer</h2>
              <p className="text-sm text-muted-foreground">Offered <strong className="text-foreground">{formatINR(counter.amount)}</strong> before GST (you quoted {enquiry.quotation ? formatINR(enquiry.quotation.amount) : "-"}).{counter.note ? ` "${counter.note}"` : ""}</p>
              <Textarea value={counterNote} onChange={(e) => setCounterNote(e.target.value)} maxLength={500} placeholder="Message to the customer (optional)" className="mt-3" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={Boolean(busy)} onClick={async () => { if (await run("accept", () => enquiryApi.decideCounter(enquiry._id, { decision: "accept", note: counterNote.trim() || undefined }), "Counter-offer accepted - new quotation sent")) setCounterNote("") }} className="bg-primary text-primary-foreground hover:bg-primary/90">Accept {formatINR(counter.amount)}</Button>
                <Button variant="outline" disabled={Boolean(busy)} onClick={async () => { if (await run("reject", () => enquiryApi.decideCounter(enquiry._id, { decision: "reject", note: counterNote.trim() || undefined }), "Counter-offer declined")) setCounterNote("") }}>Decline</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Or send a different price below with "Send revised quotation".</p>
            </Card>
          )}

          {enquiry.quotation && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-foreground">Current quotation</h2>
              <QuotationView quotation={enquiry.quotation} request={req} expired={enquiry.quotationExpired} />
              {(enquiry.quotationHistory?.length ?? 0) > 0 && <p className="mt-3 text-xs text-muted-foreground">{enquiry.quotationHistory!.length} earlier version{enquiry.quotationHistory!.length > 1 ? "s" : ""}: {enquiry.quotationHistory!.map((h) => `v${h.version} ${formatINR(h.totalAmount)}`).join(" · ")}</p>}
            </Card>
          )}

          {canQuote && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-foreground">{enquiry.quotation ? "Revise the quotation" : "Customise & send the final quotation"}</h2>
                <Button variant="outline" size="sm" onClick={() => setShowBuilder((v) => !v)}>{showBuilder ? "Hide" : enquiry.quotation ? "Propose new price / edit" : "Create quotation"}</Button>
              </div>
              {showBuilder && (
                <div className="mt-4">
                  <QuotationBuilder
                    key={enquiry.quotation?.version ?? 0}
                    enquiry={enquiry}
                    busy={busy === "quote"}
                    onSubmit={async (input: QuotationInput) => {
                      if (await run("quote", () => enquiryApi.sendQuotation(enquiry._id, input), "Quotation sent to the customer")) setShowBuilder(false)
                    }}
                  />
                </div>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-foreground">Conversation</h2>
            <Conversation
              messages={enquiry.messages}
              viewer="admin"
              canSend={chatOpen}
              onSend={async (text) => {
                try {
                  const res = await enquiryApi.adminMessage(enquiry._id, text)
                  setEnquiry((prev) => (prev ? { ...res.enquiry, adminNotes: prev.adminNotes } : res.enquiry))
                } catch (err) {
                  toast(err instanceof ApiError ? err.message : "Could not send", "error")
                  throw err
                }
              }}
            />
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-1">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-foreground">Customer</h2>
            <p className="font-medium text-foreground">{customer?.name || "Customer"}</p>
            <div className="mt-2 flex flex-col gap-1.5 text-sm">
              {customer?.email && <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="size-4" /> {customer.email}</a>}
              {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="size-4" /> {phone}</a>}
              {phone && <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline"><MessageCircle className="size-4" /> WhatsApp</a>}
            </div>
          </Card>

          {booking && (
            <Card className="p-5 text-sm">
              <h2 className="mb-2 font-semibold text-foreground">Booking</h2>
              <p className="text-muted-foreground">{booking.bookingReference} · {booking.bookingStatus} · {booking.paymentStatus.replace("_", " ")}</p>
              {booking.paymentPlan?.mode === "advance" && <p className="mt-1 text-muted-foreground">Advance {formatINR(booking.paymentPlan.advanceAmount ?? 0)} · balance {formatINR(booking.paymentPlan.balanceAmount ?? 0)} due {booking.paymentPlan.balanceDueDate ? formatDate(booking.paymentPlan.balanceDueDate) : "-"}</p>}
              <Button variant="outline" size="sm" render={<Link to="/admin/bookings" />} className="mt-3">Open bookings</Button>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-foreground">Internal notes</h2>
            <p className="mb-2 text-xs text-muted-foreground">Private - the customer never sees these.</p>
            <ul className="mb-3 space-y-2">
              {(enquiry.adminNotes ?? []).map((n, i) => (
                <li key={i} className="rounded-md bg-muted p-2 text-sm"><p className="whitespace-pre-wrap">{n.note}</p><p className="mt-1 text-[10px] text-muted-foreground">{typeof n.by === "object" ? n.by.name : "Admin"} · {formatDate(n.at)}</p></li>
              ))}
              {(enquiry.adminNotes ?? []).length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
            </ul>
            <div className="flex gap-2">
              <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={1000} placeholder="e.g. Called customer, wants Udaipur lake view" aria-label="Internal note" />
              <Button variant="outline" disabled={busy === "note" || !noteText.trim()} onClick={async () => {
                setBusy("note")
                try {
                  const res = await enquiryApi.addNote(enquiry._id, noteText.trim())
                  setEnquiry((prev) => (prev ? { ...prev, adminNotes: res.adminNotes } : prev))
                  setNoteText("")
                } catch (err) {
                  toast(err instanceof ApiError ? err.message : "Could not save the note", "error")
                } finally {
                  setBusy("")
                }
              }}>Add</Button>
            </div>
          </Card>

          {(canClose || canReopen) && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-foreground">Enquiry status</h2>
              {canReopen && <Button variant="outline" disabled={Boolean(busy)} onClick={() => run("reopen", () => enquiryApi.setStatus(enquiry._id, { status: "in_discussion" }), "Enquiry reopened")} className="w-full">Reopen discussion</Button>}
              {canClose && (showClose ? (
                <div className="space-y-2">
                  <Alert>The customer is told this enquiry is closed. Give a reason.</Alert>
                  <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} maxLength={500} placeholder="e.g. Not operating on those dates" />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={Boolean(busy) || closeReason.trim().length < 3} onClick={async () => { if (await run("close", () => enquiryApi.setStatus(enquiry._id, { status: "rejected", note: closeReason.trim() }), "Enquiry closed")) { setShowClose(false); setCloseReason("") } }} className="flex-1">Close enquiry</Button>
                    <Button variant="outline" onClick={() => setShowClose(false)}>Back</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowClose(true)} className="w-full text-destructive">Close / reject enquiry</Button>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
