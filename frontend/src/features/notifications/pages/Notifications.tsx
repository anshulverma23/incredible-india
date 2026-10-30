import { Link } from "react-router-dom"
import { Bell, CheckCheck, CreditCard, CalendarCheck, XCircle, RotateCcw, Plane, Star, Clock, Hourglass, BadgeIndianRupee } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/features/notifications/hooks/useNotifications"
import { timeAgo } from "@/features/notifications/lib/time-ago"
import type { NotificationType } from "@/features/notifications/types"

const ICONS: Record<NotificationType, typeof Bell> = {
  booking_confirmed: CalendarCheck,
  payment_success: CreditCard,
  payment_failed: XCircle,
  booking_cancelled: XCircle,
  refund_processed: RotateCcw,
  trip_reminder: Plane,
  booking_expired: Clock,
  booking_request: Hourglass,
  booking_quote: BadgeIndianRupee,
  booking_declined: XCircle,
  review_prompt: Star,
  general: Bell,
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()

  if (loading && notifications.length === 0) return <PageLoader label="Loading notifications..." />

  return (
    <main className="min-h-screen bg-muted/20 pb-20 pt-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead()}>
              <CheckCheck className="mr-2 size-4" /> Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No notifications yet. Booking confirmations, payment receipts and trip reminders will show up here.
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell
              const body = (
                <Card className={cn("flex items-start gap-4 p-4 transition-shadow hover:shadow-sm", !n.isRead && "border-primary/40 bg-primary/5")}>
                  <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{n.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  </div>
                  {!n.isRead && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                </Card>
              )
              return n.link ? (
                <Link key={n._id} to={n.link} onClick={() => markRead(n._id)}>
                  {body}
                </Link>
              ) : (
                <div key={n._id} onClick={() => markRead(n._id)}>
                  {body}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
