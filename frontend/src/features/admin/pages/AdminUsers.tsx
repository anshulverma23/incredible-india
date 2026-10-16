import { useEffect, useState } from "react"
import { UserX, UserCheck } from "lucide-react"
import { AdminTable, type AdminColumn } from "@/features/admin/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { SearchBar } from "@/components/common/search-bar"
import { useToast } from "@/hooks/useToast"
import { userApi } from "@/features/profile/api/user.api"
import { ApiError } from "@/lib/axios"
import type { Role, User } from "@/features/auth/types"

const ROLES: { value: Role; label: string }[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
]

export default function AdminUsersPage() {
  const { toast } = useToast()
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const load = () => {
    setLoading(true)
    userApi
      .adminList({ search, limit: 50 })
      .then((res) => setUsers((res.users as User[]) || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const toggleActive = async (user: User) => {
    try {
      await userApi.update(user._id, { isActive: !user.isActive })
      toast(user.isActive ? "User deactivated" : "User activated")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update user", "error")
    }
  }

  const changeRole = async (user: User, role: Role) => {
    if (role === user.role) return
    if (!confirm(`Change ${user.name}'s role from "${user.role}" to "${role}"? They will be signed out and must log in again.`)) return
    try {
      await userApi.update(user._id, { role })
      toast("Role updated")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update role", "error")
    }
  }

  // Only an admin can reach this page and change roles (the server enforces this too); nobody edits their own role.
  const canEditRole = (u: User) => u._id !== me?._id

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return
    try {
      await userApi.remove(user._id)
      toast("User deleted")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete user", "error")
    }
  }

  const columns: AdminColumn<User>[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    {
      key: "role",
      label: "Role",
      render: (u) =>
        canEditRole(u) ? (
          <Select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)} aria-label={`Role for ${u.name}`} className="h-8 w-40 text-xs">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        ) : (
          <Badge className={u.role === "admin" ? "bg-primary/10 text-primary" : ""} variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge>
        ),
    },
    { key: "status", label: "Status", render: (u) => <Badge variant={u.isActive === false ? "destructive" : "outline"}>{u.isActive === false ? "Inactive" : "Active"}</Badge> },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Manage Users</h1>
        <div className="w-full sm:w-72"><SearchBar value={search} onChange={setSearch} placeholder="Search users..." /></div>
      </div>

      <AdminTable
        columns={columns}
        rows={users}
        loading={loading}
        onDelete={deleteUser}
        extraAction={(u) => (
          <>
            <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(u)} aria-label="Toggle active" title="Activate/Deactivate">
              {u.isActive === false ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
            </Button>
          </>
        )}
      />
    </div>
  )
}
