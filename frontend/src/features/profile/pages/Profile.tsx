import { useState, type FormEvent } from "react"
import { Card } from "@/components/ui/card"
import { validatePassword } from "@/features/auth/validation/auth.validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { userApi } from "@/features/profile/api/user.api"
import { authApi } from "@/features/auth/api/auth.api"
import { ApiError } from "@/lib/axios"

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState(user?.name || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar?.url || "")
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [pwError, setPwError] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const formData = new FormData()
      formData.append("name", name)
      formData.append("phone", phone)
      if (avatarFile) formData.append("avatar", avatarFile)
      await userApi.updateProfile(formData)
      await refreshUser()
      toast("Profile updated")
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update profile", "error")
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPwError("")
    const newPasswordError = validatePassword(newPassword, "New password")
    if (newPasswordError) {
      setPwError(newPasswordError)
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      toast("Password updated")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Could not update password")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <main className="min-h-screen pt-28 pb-20 bg-muted/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <h1 className="font-serif text-3xl font-bold text-foreground">Profile Settings</h1>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground mb-4">Personal Details</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {avatarPreview ? <AvatarImage src={avatarPreview} alt={user.name} /> : null}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <input type="file" accept="image/*" id="avatar" className="hidden" onChange={handleAvatarChange} />
                <Label htmlFor="avatar" className="cursor-pointer text-sm text-primary hover:underline">Change photo</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <Button type="submit" disabled={savingProfile} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingProfile ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground mb-4">Change Password</h2>
          {pwError && <Alert variant="destructive" className="mb-4">{pwError}</Alert>}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={savingPassword} variant="outline">
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
