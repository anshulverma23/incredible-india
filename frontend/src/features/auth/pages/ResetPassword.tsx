import { useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { validatePassword } from "@/features/auth/validation/auth.validation"
import { authApi } from "@/features/auth/api/auth.api"
import { setToken } from "@/lib/storage"
import { ApiError } from "@/lib/axios"
import { useAuth } from "@/features/auth/hooks/useAuth"

export default function ResetPasswordPage() {
  const { token = "" } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    setLoading(true)
    try {
      const { token: authToken } = await authApi.resetPassword(token, password)
      setToken(authToken)
      await refreshUser()
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This reset link is invalid or has expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Set a new password</h1>
      </div>

      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input id="password" type="password" required minLength={6} className="pl-8" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </Card>
  )
}
