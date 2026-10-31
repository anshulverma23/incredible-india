import { Link, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPinned,
  Package,
  ClipboardList,
  Star,
  Ticket,
  BarChart3,
  Settings,
  ArrowLeft,
  NotebookPen,
  FileQuestionMark,
} from "lucide-react"
import { RequireAdmin } from "@/features/auth/components/route-guards"
import { PageMeta } from "@/components/common/page-meta"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Manage Users", icon: Users },
  { href: "/admin/hotels", label: "Manage Hotels", icon: Building2 },
  { href: "/admin/destinations", label: "Manage Destinations", icon: MapPinned },
  { href: "/admin/packages", label: "Manage Packages", icon: Package },
  { href: "/admin/bookings", label: "Manage Bookings", icon: ClipboardList },
  { href: "/admin/payments", label: "Manage Payments", icon: BarChart3 },
  { href: "/admin/reviews", label: "Manage Reviews", icon: Star },
  { href: "/admin/coupons", label: "Manage Coupons", icon: Ticket },
  { href: "/admin/reports", label: "Revenue & Reports", icon: BarChart3 },
  { href: "/admin/blog", label: "blog", icon: NotebookPen },
  { href: "/admin/faq", label: "FAQ", icon: FileQuestionMark },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

function AdminShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const current = navItems.find((item) => item.href === pathname)
  const label = current ? current.label.charAt(0).toUpperCase() + current.label.slice(1) : "Admin Panel"

  return (
    <div className="min-h-screen bg-muted/20 flex">
      <PageMeta title={`${label} | Admin - Incredible India Travel`} noindex />
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-5 border-b border-border">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-3.5" /> Back to site
          </Link>
          <p className="mt-2 font-serif text-xl font-bold text-foreground">Admin Panel</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" /> {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile top nav */}
        <div className="md:hidden overflow-x-auto border-b border-border bg-card p-3 flex gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                pathname === item.href ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  )
}

/**
 * Layout route for everything under /admin.
 * Next.js passed nested pages in as `children`; React Router renders them
 * through <Outlet />, but the admin-only guard works exactly as before.
 */
export default function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </RequireAdmin>
  )
}