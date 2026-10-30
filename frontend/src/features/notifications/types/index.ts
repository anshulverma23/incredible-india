export type NotificationType =
  | "booking_confirmed"
  | "payment_success"
  | "payment_failed"
  | "booking_cancelled"
  | "refund_processed"
  | "trip_reminder"
  | "booking_expired"
  | "booking_request"
  | "booking_quote"
  | "booking_declined"
  | "review_prompt"
  | "general"

export interface AppNotification {
  _id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  createdAt: string
}

export interface NotificationListResponse {
  success: boolean
  unreadCount: number
  total: number
  page: number
  pages: number
  notifications: AppNotification[]
}
