import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import { PageLoader } from "@/components/ui/spinner"
import { formatINR } from "@/lib/utils"
import { adminApi, type MonthlyRevenue } from "@/features/admin/api/admin.api"
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/status"
import type { BookingStatus } from "@/features/bookings/types"

type Group = {
  _id: string
  count: number
  amount?: number
}

type BreakdownRow = {
  label: string
  count: number
  amount?: number
}

const compactINR = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(0)}k`
      : `₹${n}`

const safeArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : []

const safeNumber = (value: unknown): number => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export default function AdminReportsPage() {
  const [months, setMonths] = useState(12)
  const [revenue, setRevenue] = useState<MonthlyRevenue[]>([])
  const [byStatus, setByStatus] = useState<Group[]>([])
  const [byType, setByType] = useState<Group[]>([])
  const [payStatus, setPayStatus] = useState<Group[]>([])
  const [payGateway, setPayGateway] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Pure fetch (no setState) so it can be used from effects and handlers alike.
  const fetchReports = useCallback(async (selectedMonths: number) => {
    const [rev, book, pay] = await Promise.all([
      adminApi.revenueReport(selectedMonths),
      adminApi.bookingReport(),
      adminApi.paymentReport(),
    ])
    return { rev, book, pay }
  }, [])

  const applyReports = useCallback(
    (data: Awaited<ReturnType<typeof fetchReports>>) => {
      // Prevent crashes if the API returns missing arrays.
      setRevenue(safeArray<MonthlyRevenue>(data.rev?.months))
      setByStatus(safeArray<Group>(data.book?.byStatus))
      setByType(safeArray<Group>(data.book?.byType))
      setPayStatus(safeArray<Group>(data.pay?.byStatus))
      setPayGateway(safeArray<Group>(data.pay?.byGateway))
      setError("")
    },
    [],
  )

  const applyError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Failed to load reports")
    setRevenue([])
    setByStatus([])
    setByType([])
    setPayStatus([])
    setPayGateway([])
  }, [])

  // Used by event handlers (refresh button).
  const reload = useCallback(
    (selectedMonths: number) => {
      setLoading(true)
      fetchReports(selectedMonths)
        .then(applyReports)
        .catch(applyError)
        .finally(() => setLoading(false))
    },
    [fetchReports, applyReports, applyError],
  )

  // Fetch on mount / when the range changes; state is only set in promise callbacks.
  useEffect(() => {
    let cancelled = false
    fetchReports(months)
      .then((d) => !cancelled && applyReports(d))
      .catch((e) => !cancelled && applyError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [months, fetchReports, applyReports, applyError])

  // Safe totals calculation.
  const totals = revenue.reduce(
    (total, item) => ({
      gross: total.gross + safeNumber(item.revenue),
      refunds: total.refunds + safeNumber(item.refunds),
      net: total.net + safeNumber(item.net),
      payments: total.payments + safeNumber(item.payments),
    }),
    {
      gross: 0,
      refunds: 0,
      net: 0,
      payments: 0,
    },
  )

  const statusRows: BreakdownRow[] = byStatus.map((group) => ({
    label:
      BOOKING_STATUS_LABEL[group._id as BookingStatus] ??
      group._id ??
      "Unknown",
    count: safeNumber(group.count),
  }))

  const typeRows: BreakdownRow[] = byType.map((group) => ({
    label:
      group._id === "hotel"
        ? "Hotel stays"
        : group._id === "package"
          ? "Tour packages"
          : group._id || "Other",
    count: safeNumber(group.count),
  }))

  const paymentStatusRows: BreakdownRow[] = payStatus.map((group) => ({
    label: (group._id || "Unknown").replaceAll("_", " "),
    count: safeNumber(group.count),
    amount:
      group.amount !== undefined
        ? safeNumber(group.amount)
        : undefined,
  }))

  const gatewayRows: BreakdownRow[] = payGateway.map((group) => ({
    label: group._id || "Unknown",
    count: safeNumber(group.count),
    amount:
      group.amount !== undefined
        ? safeNumber(group.amount)
        : undefined,
  }))

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Revenue &amp; Reports
        </h1>

        <div className="flex items-center gap-2">
          <div className="w-40">
            <Select
              value={months}
              onChange={(value) => {
                setLoading(true)
                setMonths(Number(value))
              }}
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => reload(months)}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 size-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">
            {error}
          </Alert>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <PageLoader label="Loading reports..." />
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Gross collected", formatINR(totals.gross)],
              ["Refunded", formatINR(totals.refunds)],
              ["Net revenue", formatINR(totals.net)],
              ["Successful payments", String(totals.payments)],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <p className="text-2xl font-bold text-foreground">
                  {value}
                </p>
                <p className="text-sm text-muted-foreground">
                  {label}
                </p>
              </Card>
            ))}
          </div>

          {/* Revenue chart and table */}
          <Card className="mb-6 p-5">
            <h2 className="mb-4 font-semibold text-foreground">
              Revenue trend
            </h2>

            {revenue.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No revenue data available for this period.
              </div>
            ) : (
              <div
                className="h-72"
                role="img"
                aria-label="Revenue trend area chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={revenue}
                    margin={{
                      top: 5,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      tickFormatter={compactINR}
                      tick={{ fontSize: 11 }}
                      width={52}
                    />

                    <Tooltip
                      formatter={(value) =>
                        formatINR(safeNumber(value))
                      }
                    />

                    <Legend />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Gross"
                      stroke="#2563eb"
                      fill="#2563eb22"
                    />

                    <Area
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke="#1a5f4a"
                      fill="#1a5f4a33"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Revenue table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Month</th>
                    <th className="pr-3">Payments</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Refunds</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>

                <tbody>
                  {revenue.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No monthly records found.
                      </td>
                    </tr>
                  ) : (
                    revenue.slice().reverse().map((item, index) => (
                      <tr
                        key={`${item.year}-${item.month}-${index}`}
                        className="border-b border-border/60"
                      >
                        <td className="py-2 pr-3">
                          {item.label || `${item.month}/${item.year}`}
                        </td>

                        <td className="pr-3">
                          {safeNumber(item.payments)}
                        </td>

                        <td className="text-right">
                          {formatINR(safeNumber(item.revenue))}
                        </td>

                        <td className="text-right text-muted-foreground">
                          {formatINR(safeNumber(item.refunds))}
                        </td>

                        <td className="text-right font-medium">
                          {formatINR(safeNumber(item.net))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Booking and payment breakdowns */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Breakdown
              title="Bookings by status"
              rows={statusRows}
            />

            <Breakdown
              title="Bookings by type"
              rows={typeRows}
            />

            <Breakdown
              title="Payments by status"
              rows={paymentStatusRows}
            />

            <Breakdown
              title="Payments by gateway"
              rows={gatewayRows}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Breakdown({
  title,
  rows,
}: {
  title: string
  rows: BreakdownRow[]
}) {
  const safeRows = Array.isArray(rows) ? rows : []

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold text-foreground">
        {title}
      </h2>

      {safeRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No data yet.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {safeRows.map((row, index) => (
            <li
              key={`${row.label}-${index}`}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="capitalize text-foreground">
                {row.label}
              </span>

              <span className="shrink-0 text-muted-foreground">
                {row.count}
                {row.amount !== undefined
                  ? ` · ${formatINR(row.amount)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}