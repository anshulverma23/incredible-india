import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { PageLoader } from "@/components/ui/spinner"
import { isAdminRole } from "@/features/auth/types"

/** Redirects to /login if not authenticated. Renders children once a user is confirmed. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true })
  }, [loading, user, navigate])

  if (loading || !user) return <PageLoader label="Checking your session..." />
  return <>{children}</>
}

/** Redirects non-admins away. Renders children once an admin user is confirmed. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && (!user || !isAdminRole(user.role))) navigate("/login", { replace: true })
  }, [loading, user, navigate])

  if (loading || !user || !isAdminRole(user.role)) return <PageLoader label="Checking admin access..." />
  return <>{children}</>
}
