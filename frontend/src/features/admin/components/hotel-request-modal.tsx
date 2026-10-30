import { useCallback, useEffect, useState } from "react"
import { Phone, Mail, User as UserIcon, BadgeIndianRupee, Ban, MessageSquarePlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { useToast } from "@/hooks/useToast"
import { formatDate, formatINR, nightsBetween } from "@/lib/utils"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLES, isRequestStage } from "@/features/bookings/lib/status"
import { ApiError } from "@/lib/axios"
import type { Booking } from "@/features/bookings/types"
import type { User } from "@/features/auth/types"
import type { Hotel, Room } from "@/features/hotels/types"

const label = "mb-1 block text-xs font-medium text-muted-foreground"

/**
 * Admin workflow for a hotel booking request:
 *   1. call the hotel owner (contact shown here)   2. write what was agreed (private notes)
 *   3. send the final price to the customer  -or-  decline the request.
 */
function RequestBody({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const { toast } = useToast()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  const [price, setPrice] = useState("")
  const [validHours, setValidHours] = useState("24")
  const [message, setMessage] = useState("")
  const [declineReason, setDeclineReason] = useState("")
  const [busy, setBusy] = useState("")

  const load = useCallback(
    () =>
      bookingApi
        .get(bookingId)
        .then(({ booking }) => {
          setBooking(booking)
          // pre-fill with the last agreed price, or the system estimate
          setPrice(String(booking.quote?.amount ?? booking.estimatedBasePrice ?? booking.pricing.basePrice))
        })
        .catch(() => setBooking(null))
        .finally(() => setLoading(false)),
    [bookingId],
  )

  useEffect(() => {
    load()
  }, [load])

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key)
    try {
      await fn()
      toast(okMsg)
      await load()
      onChanged()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong", "error")
    } finally {
      setBusy("")
    }
  }

  if (loading) return <PageLoader label="Loading request..." />
  if (!booking) return <p className="py-8 text-center text-sm text-muted-foreground">Could not load this booking.</p>

  const customer = typeof booking.user === "object" ? (booking.user as User) : null
  const hotel = typeof booking.hotel === "object" ? (booking.hotel as Hotel) : null
  const room = typeof booking.room === "object" ? (booking.room as Room) : null
  const owner = hotel?.ownerContact
  const open = isRequestStage(booking)
  const nights = booking.checkIn && booking.checkOut ? nightsBetween(booking.checkIn, booking.checkOut) : 0
  const noteBy = (n: NonNullable<Booking["adminNotes"]>[number]) => (typeof n.by === "object" ? n.by?.name : "")

  return (
    <div className="space-y-5 text-sm">
      {/* Request summary */}
      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{booking.bookingReference}</p>
            <p className="text-base font-semibold text-foreground">{hotel?.name}</p>
            <p className="text-xs text-muted-foreground">{hotel?.location.city}{hotel?.location.state ? `, ${hotel.location.state}` : ""}</p>
          </div>
          <Badge className={BOOKING_STATUS_STYLES[booking.bookingStatus]}>{BOOKING_STATUS_LABEL[booking.bookingStatus]}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground">Room</dt><dd>{room?.roomType} x {booking.numberOfRooms}</dd>
          <dt className="text-muted-foreground">Check-in</dt><dd>{booking.checkIn && formatDate(booking.checkIn)}</dd>
          <dt className="text-muted-foreground">Check-out</dt><dd>{booking.checkOut && formatDate(booking.checkOut)} ({nights} night{nights === 1 ? "" : "s"})</dd>
          <dt className="text-muted-foreground">Guests</dt><dd>{booking.guests.adults} adult(s), {booking.guests.children} child(ren)</dd>
          <dt className="text-muted-foreground">Estimated price</dt><dd className="font-semibold">{formatINR(booking.estimatedBasePrice ?? booking.pricing.basePrice)} <span className="font-normal text-muted-foreground">(before tax)</span></dd>
          <dt className="text-muted-foreground">Customer</dt><dd>{customer?.name} <span className="text-muted-foreground">{customer?.email}</span>{customer?.phone ? <span className="block text-muted-foreground">{customer.phone}</span> : null}</dd>
        </dl>
        {booking.specialRequests && <p className="mt-2 whitespace-pre-wrap rounded bg-background p-2 text-xs"><span className="font-medium">Customer request: </span>{booking.specialRequests}</p>}
      </div>

      {/* Step 1: contact the owner */}
      <section>
        <h3 className="mb-2 font-semibold text-foreground">1. Contact the hotel owner</h3>
        {owner && (owner.name || owner.phone || owner.email) ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {owner.name && <span className="flex items-center gap-1.5"><UserIcon className="size-3.5 text-primary" /> {owner.name}</span>}
            {owner.phone && <a className="flex items-center gap-1.5 text-primary hover:underline" href={`tel:${owner.phone}`}><Phone className="size-3.5" /> {owner.phone}</a>}
            {owner.email && <a className="flex items-center gap-1.5 text-primary hover:underline" href={`mailto:${owner.email}`}><Mail className="size-3.5" /> {owner.email}</a>}
          </div>
        ) : (
          <Alert variant="destructive">No owner contact saved for this hotel. Add it under Admin &rarr; Hotels &rarr; Edit.</Alert>
        )}
      </section>

      {/* Step 2: private notes */}
      <section>
        <h3 className="mb-2 font-semibold text-foreground">2. Notes (private - customers never see these)</h3>
        {booking.adminNotes && booking.adminNotes.length > 0 ? (
          <ul className="mb-2 space-y-1.5">
            {booking.adminNotes.map((n, i) => (
              <li key={i} className="rounded border border-border bg-background p-2 text-xs">
                <p className="whitespace-pre-wrap text-foreground">{n.note}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{noteBy(n)} {new Date(n.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">No notes yet. Write what the owner said (rooms free, price, conditions).</p>
        )}
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called owner - 2 rooms free, Rs 9,000 total" maxLength={1000} />
          <Button
            variant="outline"
            disabled={!note.trim() || busy === "note"}
            onClick={() => run("note", async () => { await bookingApi.addNote(booking._id, note.trim()); setNote("") }, "Note added")}
          >
            <MessageSquarePlus className="mr-1.5 size-4" /> Add
          </Button>
        </div>
      </section>

      {/* Step 3: answer the customer */}
      {open ? (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-foreground"><BadgeIndianRupee className="size-4 text-primary" /> 3. Send the final price</h3>
            <p className="mb-3 text-xs text-muted-foreground">Enter the room price agreed with the hotel for the WHOLE stay, before tax. Tax is added automatically. The rooms are reserved for the customer until the offer expires.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Final price (Rs, before tax)</label>
                <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label className={label}>Offer valid for (hours)</label>
                <Input type="number" min={1} max={72} value={validHours} onChange={(e) => setValidHours(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className={label}>Message to customer (optional)</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Breakfast included. Early check-in subject to availability." />
            </div>
            <Button
              className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={busy === "quote" || !(Number(price) > 0)}
              onClick={() =>
                run("quote", () => bookingApi.sendQuote(booking._id, { finalPrice: Number(price), validHours: Number(validHours) || undefined, note: message.trim() || undefined }), booking.bookingStatus === "awaiting_approval" ? "Updated price sent to the customer" : "Final price sent to the customer")
              }
            >
              {busy === "quote" ? "Sending..." : booking.bookingStatus === "awaiting_approval" ? "Update & resend price" : "Send final price to customer"}
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-foreground"><Ban className="size-4 text-destructive" /> Hotel cannot host this stay?</h3>
            <div className="flex gap-2">
              <Input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason shown to the customer" maxLength={500} />
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={declineReason.trim().length < 3 || busy === "decline"}
                onClick={() => {
                  if (confirm("Decline this request? The customer will be told it is not available.")) run("decline", () => bookingApi.decline(booking._id, declineReason.trim()), "Request declined")
                }}
              >
                Decline
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <Alert>
          This request is {BOOKING_STATUS_LABEL[booking.bookingStatus].toLowerCase()}.
          {booking.bookingStatus === "pending" && " Waiting for the customer to pay."}
          {booking.declineReason ? ` Reason given: ${booking.declineReason}` : ""}
        </Alert>
      )}
    </div>
  )
}

export function HotelRequestModal({
  bookingId,
  open,
  onOpenChange,
  onChanged,
}: {
  bookingId: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onChanged: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hotel booking request</DialogTitle>
        </DialogHeader>
        {/* mounted fresh for every request so its form fields never show stale values */}
        {open && bookingId && <RequestBody key={bookingId} bookingId={bookingId} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  )
}
