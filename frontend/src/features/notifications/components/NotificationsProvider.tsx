import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { io } from "socket.io-client"
import { env } from "@/config/env"
import { getToken } from "@/lib/storage"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { notificationApi } from "@/features/notifications/api/notification.api"
import { NotificationsContext } from "@/features/notifications/hooks/useNotifications"
import type { AppNotification } from "@/features/notifications/types"

/**
 * Loads the signed-in user's notifications and keeps them live over Socket.IO
 * (the server pushes a "notification" event the moment a payment / booking / refund changes).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast // keep the socket subscription stable while still calling the latest toast
  }, [toast])
  const userId = user?._id

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) return
    try {
      const res = await notificationApi.list({ limit: 20 })
      setNotifications(res.notifications)
      setUnreadCount(res.unreadCount)
    } catch {
      /* the bell is non-critical - never break the page */
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    reload().finally(() => active && setLoading(false))

    const socket = io(env.SOCKET_URL, {
      // function form -> a fresh access token is used on every (re)connect
      auth: (cb) => cb({ token: getToken() }),
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
    })
    socket.on("notification", (n: AppNotification) => {
      setNotifications((prev) => [n, ...prev.filter((x) => x._id !== n._id)].slice(0, 50))
      setUnreadCount((c) => c + 1)
      toastRef.current(n.title)
    })
    return () => {
      active = false
      socket.disconnect()
    }
  }, [userId, reload])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    await notificationApi.markRead(id).catch(() => {})
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    await notificationApi.markAllRead().catch(() => {})
  }, [])

  // Signed-out users see nothing (derived at read time, so no state reset is needed on logout)
  const value = useMemo(
    () => ({
      notifications: userId ? notifications : [],
      unreadCount: userId ? unreadCount : 0,
      loading,
      markRead,
      markAllRead,
      reload,
    }),
    [userId, notifications, unreadCount, loading, markRead, markAllRead, reload],
  )
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
