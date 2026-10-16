import { Link, useNavigate } from "react-router-dom"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/features/notifications/hooks/useNotifications"
import { timeAgo } from "@/features/notifications/lib/time-ago"

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
          />
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={() => markAllRead()}>
                <CheckCheck className="mr-1 size-3" /> Mark all read
              </Button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          notifications.slice(0, 6).map((n) => (
            <DropdownMenuItem
              key={n._id}
              className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
              onClick={() => {
                markRead(n._id)
                if (n.link) navigate(n.link)
              }}
            >
              <span className="flex w-full items-center gap-2 text-sm font-medium text-foreground">
                {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                <span className="truncate">{n.title}</span>
                <span className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/notifications" />} className="cursor-pointer justify-center text-sm text-primary">
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
