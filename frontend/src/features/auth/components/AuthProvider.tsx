import { useEffect, useState, type ReactNode } from "react"
import { authApi } from "@/features/auth/api/auth.api"
import { AuthContext } from "@/features/auth/hooks/useAuth"
import type { User } from "@/features/auth/types"
import { ApiError } from "@/lib/axios"
import { getToken, setToken, clearToken } from "@/lib/storage"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // No stored token means there's nothing to verify with the API, so skip the
  // loading state entirely instead of flipping it synchronously in an effect.
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  const fetchAndSetUser = () =>
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) clearToken()
        setUser(null)
      })

  const refreshUser = async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      return
    }
    await fetchAndSetUser()
  }

  useEffect(() => {
    if (!getToken()) return
    fetchAndSetUser().finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login({ email, password })
    setToken(token)
    setUser(user)
  }

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const { token, user } = await authApi.register({ name, email, password, phone })
    setToken(token)
    setUser(user)
  }

  const loginWithGoogle = async (idToken: string) => {
    const { token, user } = await authApi.google(idToken)
    setToken(token)
    setUser(user)
  }

  // Revoke the refresh token on the server FIRST (it needs the access token), then forget everything locally.
  const logout = () => {
    authApi
      .logout()
      .catch(() => { })
      .finally(() => clearToken())
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
