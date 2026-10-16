import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { SearchBar } from "@/components/common/search-bar"
import { DestinationCard } from "@/components/cards/destination-card"
import { Pagination } from "@/components/common/pagination"
import { PageLoader } from "@/components/ui/spinner"
import { destinationApi } from "@/features/destinations/api/destination.api"
import type { Destination } from "@/features/destinations/types"

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // `loading` is flipped back to true by the search/page handlers below, right
  // where `search`/`page` change - so this effect only ever reads it, it never
  // has to set it synchronously itself.
  useEffect(() => {
    let ignore = false
    destinationApi
      .list({ search, page, limit: 12 })
      .then((res) => {
        if (ignore) return
        setDestinations((res.destinations as Destination[]) || [])
        setPages(res.pages || 1)
      })
      .catch(() => !ignore && setDestinations([]))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [search, page])

  return (
    <main className="min-h-screen pt-28 pb-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-accent font-medium text-sm uppercase tracking-widest mb-2">Explore</p>
          <h1 className="font-manrope text-3xl md:text-4xl font-bold text-foreground mb-4">All Destinations</h1>
          <p className="text-muted-foreground mb-6">
            Browse every destination in our directory, with live weather, nearby hotels and curated tour packages. Looking for our editorial travel guides instead? Check out the{" "}
            <Link to="/#destinations" className="text-primary hover:underline">featured destinations</Link> on the homepage.
          </p>
          <SearchBar value={search} onChange={(v) => { setLoading(true); setSearch(v); setPage(1) }} placeholder="Search by name, city, state..." />
        </div>

        {loading ? (
          <PageLoader label="Loading destinations..." />
        ) : destinations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
            No destinations found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {destinations.map((d) => (
                <DestinationCard key={d._id} destination={d} />
              ))}
            </div>
            <Pagination page={page} pages={pages} onChange={(p) => { setLoading(true); setPage(p) }} />
          </>
        )}
      </div>
    </main>
  )
}
