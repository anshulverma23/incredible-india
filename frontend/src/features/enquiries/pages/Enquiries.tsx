import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, MessagesSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/spinner"
import { formatDate } from "@/lib/utils"
import { enquiryApi } from "@/features/enquiries/api/enquiry.api"
import { CUSTOMER_STATUS_LABEL, ENQUIRY_STATUS_STYLES, packageName } from "@/features/enquiries/lib/status"
import type { PackageEnquiry } from "@/features/enquiries/types"

/** Customer: all package enquiries and where each one stands. */
export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<PackageEnquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enquiryApi
      .my()
      .then((res) => setEnquiries(res.enquiries))
      .catch(() => setEnquiries([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader label="Loading your enquiries..." />

  return (
    <main className="min-h-screen bg-muted/30 pb-20 pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-serif text-3xl font-bold text-foreground">My Enquiries</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Packages you are discussing with our travel experts.</p>

        {enquiries.length === 0 ? (
          <Card className="items-center p-10 text-center">
            <MessagesSquare className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">You have not discussed a package yet.</p>
            <Button render={<Link to="/packages" />} className="bg-primary text-primary-foreground hover:bg-primary/90">Browse packages</Button>
          </Card>
        ) : (
          <ul className="space-y-3">
            {enquiries.map((e) => {
              const needsYou = e.status === "quotation_sent" || (e.lastMessageBy === "admin" && ["new", "in_discussion", "revision_requested"].includes(e.status))
              return (
                <li key={e._id}>
                  <Link to={`/enquiries/${e._id}`} className="block rounded-xl ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
                    <Card className="flex-row items-center gap-4 p-4 ring-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-foreground">{packageName(e)}</p>
                          <Badge className={ENQUIRY_STATUS_STYLES[e.status]}>{CUSTOMER_STATUS_LABEL[e.status]}</Badge>
                          {needsYou && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Needs your attention</span>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {e.enquiryNumber} · from {formatDate(e.request.startDate)} · {e.request.adults + e.request.children} traveller{e.request.adults + e.request.children > 1 ? "s" : ""}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
