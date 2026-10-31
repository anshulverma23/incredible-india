import { PageMeta } from "@/components/common/page-meta"
import { pageTitle } from "@/lib/seo"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { SearchBar } from "@/components/common/search-bar"
import { FilterSidebar, FilterGroup } from "@/components/common/filter-sidebar"
import { PackageCard } from "@/components/cards/package-card"
import { Pagination } from "@/components/common/pagination"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { packageApi } from "@/features/packages/api/package.api"
import type { TourPackage } from "@/features/packages/types"

const CATEGORIES = ["Adventure", "Luxury", "Family", "Honeymoon", "Pilgrimage", "Wildlife", "Cultural"]
const AMENITIES = ["Meals", "Airport Transfer", "Guide", "Wi-Fi", "Adventure Activities"]

const EMPTY = { search: "", destination: "", category: "", minDuration: "", maxDuration: "", minPrice: "", maxPrice: "", minRating: "", startDate: "", endDate: "", amenities: [] as string[], sort: "" }
type Filters = typeof EMPTY

export default function PackagesPage() {
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [f, setF] = useState<Filters>({ ...EMPTY, destination: searchParams.get("destination") || "", search: searchParams.get("search") || "" })

  // Every filter change goes through update(), which flips `loading` itself - the effect below only fetches.
  const update = (patch: Partial<Filters>) => {
    setLoading(true)
    setF((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  useEffect(() => {
    let ignore = false
    packageApi
      .list({ ...f, amenities: f.amenities.join(","), page, limit: 9 })
      .then((res) => {
        if (ignore) return
        setPackages((res.packages as TourPackage[]) || [])
        setPages(res.pages || 1)
        setTotal(res.total || 0)
      })
      .catch(() => !ignore && setPackages([]))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [f, page])

  const toggleAmenity = (a: string) => update({ amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })
  const clearFilters = () => update({ ...EMPTY, search: f.search })

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <PageMeta title={pageTitle("India Tour Packages")} description="Explore India tour packages: adventure, luxury, family, honeymoon, pilgrimage and wildlife trips with day-wise itineraries, inclusions and prices." canonical="/packages" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">Curated Journeys</p>
            <h1 className="mb-4 font-manrope text-3xl font-bold text-foreground md:text-4xl">Tour Packages</h1>
            <SearchBar value={f.search} onChange={(v) => update({ search: v })} placeholder="Search packages, e.g. Kashmir..." />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">Sort by:</span>
            <Select value={f.sort} onChange={(e) => update({ sort: e.target.value })} className="w-44">
              <option value="">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="duration_asc">Shortest first</option>
              <option value="popular">Most reviewed</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <FilterSidebar onClear={clearFilters}>
            <FilterGroup label="Destination">
              <Input value={f.destination} onChange={(e) => update({ destination: e.target.value })} placeholder="e.g. Kashmir" />
            </FilterGroup>
            <FilterGroup label="Category">
              <Select value={f.category} onChange={(e) => update({ category: e.target.value })}>
                <option value="">Any category</option>
                {CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FilterGroup>
            <FilterGroup label="Price per person (₹)">
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={f.minPrice} onChange={(e) => update({ minPrice: e.target.value })} />
                <span className="text-muted-foreground">-</span>
                <Input type="number" placeholder="Max" value={f.maxPrice} onChange={(e) => update({ maxPrice: e.target.value })} />
              </div>
            </FilterGroup>
            <FilterGroup label="Duration (days)">
              <div className="flex items-center gap-2">
                <Input type="number" min={1} placeholder="Min" value={f.minDuration} onChange={(e) => update({ minDuration: e.target.value })} />
                <span className="text-muted-foreground">-</span>
                <Input type="number" min={1} placeholder="Max" value={f.maxDuration} onChange={(e) => update({ maxDuration: e.target.value })} />
              </div>
            </FilterGroup>
            <FilterGroup label="Minimum rating">
              <Select value={f.minRating} onChange={(e) => update({ minRating: e.target.value })}>
                <option value="">Any rating</option>
                {[4.5, 4, 3].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
              </Select>
            </FilterGroup>
            <FilterGroup label="Departure between">
              <div className="space-y-2">
                <input type="date" value={f.startDate} onChange={(e) => update({ startDate: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" aria-label="Departure from" />
                <input type="date" value={f.endDate} min={f.startDate || undefined} onChange={(e) => update({ endDate: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" aria-label="Departure until" />
              </div>
            </FilterGroup>
            <FilterGroup label="Inclusions">
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    aria-pressed={f.amenities.includes(a)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", f.amenities.includes(a) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary")}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </FilterGroup>
          </FilterSidebar>

          <div className="flex-1">
            {loading ? (
              <PageLoader label="Finding packages..." />
            ) : packages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">No packages found. Try adjusting your filters.</div>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">{total} package{total === 1 ? "" : "s"} found</p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map((pkg) => <PackageCard key={pkg._id} pkg={pkg} />)}
                </div>
                <Pagination page={page} pages={pages} onChange={(p) => { setLoading(true); setPage(p) }} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
