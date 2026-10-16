import type { ReactNode } from "react"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { ToastProvider } from "@/components/common/ToastProvider"
import { env } from "@/config/env"
import { AuthProvider } from "@/features/auth/components/AuthProvider"
import { NotificationsProvider } from "@/features/notifications/components/NotificationsProvider"

/** All global context providers, composed in one place. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={env.GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ToastProvider>
          <NotificationsProvider>{children}</NotificationsProvider>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
