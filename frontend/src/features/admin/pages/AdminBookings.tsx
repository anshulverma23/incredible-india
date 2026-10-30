import { useEffect, useState } from "react"
import { CheckCheck, Ban, ClipboardList } from "lucide-react"
import { AdminTable, type AdminColumn } from "@/features/admin/components/data-table"
import { HotelRequestModal } from "@/features/admin/components/hotel-request-modal"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/common/search-bar"
import { useToast } from "@/hooks/useToast"
import { formatDate, formatINR } from "@/lib/utils"
import { bookingApi } from "@/features/bookings/api/booking.api"
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLES, PAYMENT_STATUS_LABEL } from "@/features/bookings/lib/status"
import { ApiError } from "@/lib/axios"
import type { Booking, BookingStatus } from "@/features/bookings/types"
import type { User } from "@/features/auth/types"
import type { Hotel } from "@/features/hotels/types"
import type { TourPackage } from "@/features/packages/types"

const STATUSES: BookingStatus[] = ["pending_confirmation", "awaiting_approval", "pending", "confirmed", "completed", "cancelled", "declined", "refunded", "failed", "expired"]

export default function AdminBookingsPage() {
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [requestId, setRequestId] = useState<string | null>(null)

  const fetchBookings = () =>
    bookingApi
      .adminList({ status: statusFilter, search, limit: 50 })
      .then((res) => setBookings((res.bookings as Booking[]) || []))
      .catch((err) => {
        toast(err instanceof ApiError ? err.message : "Could not load bookings", "error")
        setBookings([])
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    const t = setTimeout(fetchBookings, search ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search])

  const reload = async () => {
    setLoading(true)
    await fetchBookings()
  }

  const markCompleted = async (b: Booking) => {
    try {
      await bookingApi.updateStatus(b._id, "completed")
      toast("Booking marked as completed")
      await reload()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update status", "error")
    }
  }

  // Cancelling goes through the cancel endpoint so refunds, inventory release, emails and notifications all happen.
  const cancel = async (b: Booking) => {
    const paid = b.paymentStatus === "paid"
    let percent: number | undefined
    if (paid) {
      const answer = prompt(
        `Cancel ${b.bookingReference} (paid ${formatINR(b.pricing.totalAmount)}).\n\nRefund percentage to give the customer?\nLeave empty to apply the standard cancellation policy (90% / 50% / 0%).`,
        "",
      )
      if (answer === null) return
      if (answer.trim() !== "") {
        percent = Number(answer)
        if (Number.isNaN(percent) || percent < 0 || percent > 100) return toast("Enter a number from 0 to 100", "error")
      }
    } else if (!confirm(`Cancel unpaid booking ${b.bookingReference}?`)) return

    try {
      const { refund } = await bookingApi.adminCancel(b._id, "Cancelled by admin", percent)
      toast(refund.amount > 0 ? `Cancelled. Refunded ${formatINR(refund.amount)}` : "Booking cancelled")
      await reload()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not cancel booking", "error")
    }
  }

  const columns: AdminColumn<Booking>[] = [
    { key: "bookingReference", label: "Booking ID", render: (b) => <span className="font-mono text-xs">{b.bookingReference || "—"}</span> },
    
{
  key: "user",
  label: "Customer",
  render: (b) => {
    if (!b.user || typeof b.user !== "object") {
      return "User unavailable"
    }

    return (b.user as User).name || "—"
  },
},
    
{
  key: "item",
  label: "Item",
  render: (b) => {
    if (b.bookingType === "hotel") {
      if (!b.hotel || typeof b.hotel !== "object") {
        return "Hotel unavailable"
      }

      return (b.hotel as Hotel).name || "Hotel unavailable"
    }

    if (!b.package || typeof b.package !== "object") {
      return "Package unavailable"
    }

    return (b.package as TourPackage).name || "Package unavailable"
  },
},
    { key: "createdAt", label: "Booked", render: (b) => (b.createdAt ? formatDate(b.createdAt) : "—") },
    {
      key: "amount",
      label: "Amount",
      render: (b) => (b.bookingStatus === "pending_confirmation" ? <span className="text-muted-foreground">Est. {formatINR(b.estimatedBasePrice ?? b.pricing?.basePrice ?? 0)}</span> : formatINR(b.pricing?.totalAmount || 0)),
    },
    { key: "paymentStatus", label: "Payment", render: (b) => <Badge variant="outline">{PAYMENT_STATUS_LABEL[b.paymentStatus] || b.paymentStatus}</Badge> },
    { key: "bookingStatus", label: "Status", render: (b) => <Badge className={BOOKING_STATUS_STYLES[b.bookingStatus]}>{BOOKING_STATUS_LABEL[b.bookingStatus]}</Badge> },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Manage Bookings</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:w-60"><SearchBar value={search} onChange={(v) => { setLoading(true); setSearch(v) }} placeholder="Search booking ID..." /></div>
          <div className="w-full sm:w-44">
            <Select value={statusFilter} onChange={(e) => { setLoading(true); setStatusFilter(e.target.value) }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={bookings}
        loading={loading}
        extraAction={(b) => (
          <>
            {b.bookingType === "hotel" && (
              <Button
                variant={b.bookingStatus === "pending_confirmation" ? "default" : "ghost"}
                size={b.bookingStatus === "pending_confirmation" ? "sm" : "icon-sm"}
                onClick={() => setRequestId(b._id)}
                aria-label="Manage hotel request"
                title="Contact hotel, send final price or decline"
                className={b.bookingStatus === "pending_confirmation" ? "bg-primary text-primary-foreground hover:bg-primary/90" : undefined}
              >
                <ClipboardList className="size-3.5" />
                {b.bookingStatus === "pending_confirmation" && <span className="ml-1">Handle</span>}
              </Button>
            )}
            {b.bookingStatus === "confirmed" && (
              <Button variant="ghost" size="icon-sm" onClick={() => markCompleted(b)} aria-label="Mark completed" title="Mark trip as completed (unlocks reviews)">
                <CheckCheck className="size-3.5" />
              </Button>
            )}
            {(b.bookingStatus === "pending_confirmation" || b.bookingStatus === "awaiting_approval" || b.bookingStatus === "pending" || b.bookingStatus === "confirmed") && (
              <Button variant="ghost" size="icon-sm" onClick={() => cancel(b)} aria-label="Cancel booking" title="Cancel & refund" className="text-destructive">
                <Ban className="size-3.5" />
              </Button>
            )}
          </>
        )}
      />

      <HotelRequestModal
        bookingId={requestId}
        open={requestId !== null}
        onOpenChange={(o) => !o && setRequestId(null)}
        onChanged={reload}
      />
    </div>
  )
}
