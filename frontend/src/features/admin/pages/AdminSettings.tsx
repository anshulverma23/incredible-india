import { Link } from "react-router-dom"
import { ExternalLink, Mail, Server } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { env } from "@/config/env"

export default function AdminSettingsPage() {
  const { user } = useAuth()
  if (!user) return null
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-bold text-foreground mb-6">Settings</h1>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold text-foreground mb-4">Admin Account</h2>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {user.avatar?.url ? <AvatarImage src={user.avatar.url} alt={user.name} /> : null}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Link to="/profile" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Edit profile & password <ExternalLink className="size-3.5" />
        </Link>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-foreground mb-4">System Info</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-foreground/90"><Server className="size-4 text-primary" /> API endpoint: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{env.API_URL}</code></div>
          <div className="flex items-center gap-2 text-foreground/90"><Mail className="size-4 text-primary" /> Booking confirmations & password resets are sent via the SMTP settings configured on the backend.</div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Payment gateway (Razorpay), Cloudinary, and Google OAuth are configured via environment variables on the backend - see <code className="bg-muted px-1 rounded">backend/.env.example</code>.
        </p>
      </Card>
    </div>
  )
}
