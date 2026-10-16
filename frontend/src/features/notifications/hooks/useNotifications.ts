import { createContext, useContext } from "react"
import type { AppNotification } from "@/features/notifications/types"

export interface NotificationsContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  reload: () => Promise<void>
}

export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider")
  return ctx
}
