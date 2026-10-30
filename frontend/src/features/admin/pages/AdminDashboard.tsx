import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Users, ClipboardList, IndianRupee, Clock, XCircle, CheckCircle2, Building2, Package, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { formatDate, formatINR } from "@/lib/utils"
import { adminApi, type DashboardData } from "@/features/admin/api/admin.api"
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/status"
import type { BookingStatus } from "@/features/bookings/types"

const PIE_COLORS = ["#1a5f4a", "#d4a017", "#2563eb", "#dc2626", "#7c3aed", "#6b7280", "#0891b2"]
const compactINR = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${n}`)

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the dashboard"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader label="Loading dashboard..." />
  if (!data) return <Alert variant="destructive">{error || "No data"}</Alert>

  const { stats } = data
  const cards = [
    { label: "Net revenue", value: formatINR(stats.totalRevenue || 0), icon: IndianRupee, primary: true },
    { label: "Total bookings", value: stats.totalBookings, icon: ClipboardList },
    { label: "Total users", value: stats.totalUsers, icon: Users },
    { label: "Hotel requests to handle", value: stats.pendingRequests ?? 0, icon: Clock },
    { label: "Awaiting payment", value: stats.pendingBookings, icon: Clock },
    { label: "Confirmed", value: stats.confirmedBookings, icon: CheckCircle2 },
    { label: "Cancelled / refunded", value: stats.cancelledBookings, icon: XCircle },
    { label: "Hotels", value: stats.totalHotels, icon: Building2 },
    { label: "Packages", value: stats.totalPackages, icon: Package },
  ]
  const statusPie = data.bookingsByStatus.map((s) => ({ name: BOOKING_STATUS_LABEL[s._id as BookingStatus] || s._id, value: s.count }))

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, primary }) => (
          <Card key={label} className={primary ? "bg-primary p-5 text-primary-foreground" : "p-5"}>
            <Icon className={`mb-2 size-5 ${primary ? "opacity-90" : "text-primary"}`} />
            <p className={`text-2xl font-bold ${primary ? "" : "text-foreground"}`}>{value ?? 0}</p>
            <p className={`text-sm ${primary ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground"><TrendingUp className="size-4 text-primary" /> Monthly revenue</h2>
          <p className="mb-4 text-xs text-muted-foreground">Last 12 months, after refunds</p>
          <div className="h-72" role="img" aria-label="Monthly revenue bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compactINR} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => formatINR(Number(v) || 0)} />
                <Legend />
                <Bar dataKey="net" name="Net revenue" fill="#1a5f4a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="refunds" name="Refunded" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-foreground">Bookings by status</h2>
          {statusPie.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <div className="h-72" role="img" aria-label="Bookings by status pie chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-foreground">Popular destinations</h2>
          {data.popularDestinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Appears once bookings are confirmed.</p>
          ) : (
            <ol className="space-y-3">
              {data.popularDestinations.map((d, i) => {
                const max = data.popularDestinations[0].bookings || 1
                return (
                  <li key={d._id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-foreground">{i + 1}. {d.name || "Destination"}</span>
                      <span className="text-muted-foreground">{d.bookings} booking{d.bookings === 1 ? "" : "s"} · {formatINR(d.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(d.bookings / max) * 100}%` }} /></div>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-foreground">Popular packages</h2>
          {data.popularPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Appears once package bookings are confirmed.</p>
          ) : (
            <ol className="divide-y divide-border text-sm">
              {data.popularPackages.map((p, i) => (
                <li key={p._id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-foreground">{i + 1}. {p.name || "Package"}</span>
                  <span className="text-muted-foreground">{p.bookings} bookings · {p.travellers} travellers</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <h2 className="mb-4 font-serif text-xl font-bold text-foreground">Recent bookings</h2>
      {data.recentBookings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No bookings yet.</Card>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.recentBookings.map((b) => {
            const userObj = typeof b.user === "object" ? b.user : null
            return (
              <Link key={b._id} to="/admin/bookings" className="flex items-center justify-between p-4 hover:bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{userObj?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{b.bookingReference} · {formatDate(b.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{formatINR(b.pricing.totalAmount)}</span>
                  <Badge variant="outline">{BOOKING_STATUS_LABEL[b.bookingStatus]}</Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
