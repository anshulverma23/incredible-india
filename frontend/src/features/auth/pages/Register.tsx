import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Mail, Lock, User, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { validatePassword } from "@/features/auth/validation/auth.validation"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { ApiError } from "@/lib/axios"
import { GoogleLogin } from "@react-oauth/google"

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    const passwordError = validatePassword(form.password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    setLoading(true)
    try {
      await register(form.name, form.email, form.password, form.phone)
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Book hotels & tour packages across India</p>
      </div>

      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input id="name" required className="pl-8" value={form.name} onChange={update("name")} placeholder="Priya Sharma" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input id="email" type="email" required className="pl-8" value={form.email} onChange={update("email")} placeholder="you@example.com" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input id="phone" type="tel" className="pl-8" value={form.phone} onChange={update("phone")} placeholder="+91 98765 43210" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input id="password" type="password" required minLength={6} className="pl-8" value={form.password} onChange={update("password")} placeholder="At least 6 characters" />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              try {
                setError("")
                setLoading(true)
                if (credentialResponse.credential) {
                  await loginWithGoogle(credentialResponse.credential)
                  navigate("/dashboard")
                }
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Google sign-up failed.")
              } finally {
                setLoading(false)
              }
            }}
            onError={() => {
              setError("Google sign-up failed.")
            }}
          />
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
      </p>
    </Card>
  )
}
