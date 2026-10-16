import { api, type QueryParams } from "@/lib/axios"
import type { AppNotification, NotificationListResponse } from "@/features/notifications/types"

export const notificationApi = {
  list: (params: QueryParams = {}) => api.get<NotificationListResponse>("/notifications", params),
  markRead: (id: string) => api.put<{ notification: AppNotification }>(`/notifications/${id}/read`),
  markAllRead: () => api.put<{ success: boolean }>("/notifications/read-all"),
  remove: (id: string) => api.delete(`/notifications/${id}`),
}
