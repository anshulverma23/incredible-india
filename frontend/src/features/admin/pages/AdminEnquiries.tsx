import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Inbox, MessageCircleReply, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/ui/spinner"
import { cn, formatDate, formatINR } from "@/lib/utils"
import { enquiryApi } from "@/features/enquiries/api/enquiry.api"
import { ENQUIRY_FILTERS, ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLES, budgetLabel, packageName } from "@/features/enquiries/lib/status"
import type { EnquiryStats, EnquiryStatus, PackageEnquiry } from "@/features/enquiries/types"

type Result = { key: string; enquiries: PackageEnquiry[]; total: number; pages: number } | null

const customerName = (e: PackageEnquiry) => (typeof e.user === "object" ? e.user.name : "Customer")

/** Admin: every package enquiry, newest activity first, with the counts that need attention. */
export default function AdminEnquiriesPage() {
  const [stats, setStats] = useState<EnquiryStats | null>(null)
  const [filter, setFilter] = useState<EnquiryStatus | "all">("all")
  const [searchText, setSearchText] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Result>(null)

  const key = `${filter}|${search}|${page}`

  useEffect(() => {
    enquiryApi.adminStats().then(setStats).catch(() => setStats(null))
  }, [])

  // wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchText.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchText])

  useEffect(() => {
    let cancelled = false
    enquiryApi
      .adminList({ status: filter, search, page, limit: 20 })
      .then((res) => !cancelled && setResult({ key, enquiries: res.enquiries, total: res.total, pages: res.pages }))
      .catch(() => !cancelled && setResult({ key, enquiries: [], total: 0, pages: 1 }))
    return () => {
      cancelled = true
    }
  }, [filter, search, page, key])

  const loading = result?.key !== key
  const by = stats?.byStatus

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-foreground">Package Enquiries</h1>
      <p className="mb-5 text-sm text-muted-foreground">Discuss, customise and quote - then the customer accepts and pays.</p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "New enquiries", value: by?.new, icon: Inbox, tone: "text-amber-700" },
          { label: "Needs your reply", value: stats?.awaitingAdmin, icon: MessageCircleReply, tone: "text-destructive" },
          { label: "Awaiting customer", value: by?.quotation_sent, icon: ArrowRight, tone: "text-violet-700" },
          { label: "Booked", value: by?.booked, icon: ArrowRight, tone: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.tone)}>{s.value ?? "-"}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ENQUIRY_FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => { setFilter(f.value); setPage(1) }} aria-pressed={filter === f.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            {f.label}{f.value !== "all" && by?.[f.value] ? ` (${by[f.value]})` : ""}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search ENQ number, name, email" className="pl-8" aria-label="Search enquiries" />
        </div>
      </div>

      {loading ? (
        <PageLoader label="Loading enquiries..." />
      ) : result && result.enquiries.length === 0 ? (
        <Card className="items-center p-10 text-center text-muted-foreground">No enquiries found.</Card>
      ) : (
        <ul className="space-y-3">
          {result?.enquiries.map((e) => {
            const people = e.request.adults + e.request.children
            const needsReply = ["new", "revision_requested", "counter_offered"].includes(e.status) || (e.status === "in_discussion" && e.lastMessageBy === "customer")
            return (
              <li key={e._id}>
                <Link to={`/admin/enquiries/${e._id}`} className="block rounded-xl ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
                  <Card className="flex-row flex-wrap items-center gap-4 p-4 ring-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{packageName(e)}</p>
                      <p className="text-sm text-muted-foreground">Customer: {customerName(e)} · {people} traveller{people > 1 ? "s" : ""} · from {formatDate(e.request.startDate)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.enquiryNumber}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-xs text-muted-foreground">{e.quotation ? "Final quotation" : "Customer budget"}</p>
                      <p className="font-semibold text-foreground">{e.quotation ? `${formatINR(e.quotation.totalAmount)} incl. GST` : budgetLabel(e, formatINR)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={ENQUIRY_STATUS_STYLES[e.status]}>{ENQUIRY_STATUS_LABEL[e.status]}</Badge>
                      {needsReply && <span className="text-[10px] font-semibold text-destructive">Needs your reply</span>}
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {result && result.pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {result.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
