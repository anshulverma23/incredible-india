import { PageMeta } from "@/components/common/page-meta"
import { pageTitle } from "@/lib/seo"
import { useEffect, useState } from "react"
import { SearchBar } from "@/components/common/search-bar"
import { FilterSidebar, FilterGroup } from "@/components/common/filter-sidebar"
import { HotelCard } from "@/components/cards/hotel-card"
import { Pagination } from "@/components/common/pagination"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PageLoader } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { hotelApi } from "@/features/hotels/api/hotel.api"
import type { Hotel } from "@/features/hotels/types"

const HOTEL_TYPES = ["Budget", "Standard", "Luxury", "Resort", "Boutique", "Heritage"]
const AMENITIES = ["WiFi", "Pool", "Spa", "Parking", "Breakfast"]
const EMPTY = { search: "", city: "", hotelType: "", rating: "", minPrice: "", maxPrice: "", checkIn: "", checkOut: "", rooms: "1", amenities: [] as string[], sort: "" }
type Filters = typeof EMPTY

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [f, setF] = useState<Filters>(EMPTY)

  const update = (patch: Partial<Filters>) => {
    setLoading(true)
    setF((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  useEffect(() => {
    let ignore = false
    // Dates only count when both are set (server then returns only hotels with a free room for the whole stay)
    const dates = f.checkIn && f.checkOut ? { checkIn: f.checkIn, checkOut: f.checkOut, rooms: f.rooms } : {}
    hotelApi
      .list({ search: f.search, city: f.city, hotelType: f.hotelType, rating: f.rating, minPrice: f.minPrice, maxPrice: f.maxPrice, amenities: f.amenities.join(","), sort: f.sort, ...dates, page, limit: 9 })
      .then((res) => {
        if (ignore) return
        setHotels((res.hotels as Hotel[]) || [])
        setPages(res.pages || 1)
      })
      .catch(() => !ignore && setHotels([]))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [f, page])

  const toggleAmenity = (a: string) => update({ amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })
  const today = new Date().toISOString().split("T")[0]

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <PageMeta title={pageTitle("Hotels in India - Book Your Stay")} description="Browse hotels across India, from budget stays to luxury resorts and heritage palaces. Compare rooms, prices and amenities, then send a booking request." canonical="/hotels" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">Stay in Style</p>
            <h1 className="mb-4 font-manrope text-3xl font-bold text-foreground md:text-4xl">Find Your Hotel</h1>
            <SearchBar value={f.search} onChange={(v) => update({ search: v })} placeholder="Search by hotel name, city..." />
          </div>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">Sort by:</span>
            <Select value={f.sort} onChange={(e) => update({ sort: e.target.value })} className="w-44">
              <option value="">Newest</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <FilterSidebar onClear={() => update({ ...EMPTY, search: f.search })}>
            <FilterGroup label="City">
              <Input value={f.city} onChange={(e) => update({ city: e.target.value })} placeholder="e.g. Jaipur" />
            </FilterGroup>
            <FilterGroup label="Available for your dates">
              <div className="space-y-2">
                <input type="date" min={today} value={f.checkIn} onChange={(e) => update({ checkIn: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" aria-label="Check-in" />
                <input type="date" min={f.checkIn || today} value={f.checkOut} onChange={(e) => update({ checkOut: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring" aria-label="Check-out" />
                <Select value={f.rooms} onChange={(e) => update({ rooms: e.target.value })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} room{n > 1 ? "s" : ""}</option>)}
                </Select>
              </div>
            </FilterGroup>
            <FilterGroup label="Hotel Type">
              <Select value={f.hotelType} onChange={(e) => update({ hotelType: e.target.value })}>
                <option value="">Any type</option>
                {HOTEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FilterGroup>
            <FilterGroup label="Minimum Rating">
              <Select value={f.rating} onChange={(e) => update({ rating: e.target.value })}>
                <option value="">Any rating</option>
                {[4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
              </Select>
            </FilterGroup>
            <FilterGroup label="Price per night (₹)">
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Min" value={f.minPrice} onChange={(e) => update({ minPrice: e.target.value })} />
                <span className="text-muted-foreground">-</span>
                <Input type="number" placeholder="Max" value={f.maxPrice} onChange={(e) => update({ maxPrice: e.target.value })} />
              </div>
            </FilterGroup>
            <FilterGroup label="Amenities">
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
              <PageLoader label="Finding hotels..." />
            ) : hotels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">No hotels found. Try adjusting your filters or dates.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {hotels.map((hotel) => <HotelCard key={hotel._id} hotel={hotel} />)}
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
