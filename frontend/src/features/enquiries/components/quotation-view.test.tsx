import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatINR } from "@/lib/utils"
import { canOfferAdvance } from "@/features/enquiries/lib/payment-plan"
import type { PackageEnquiry, QuotationInput } from "@/features/enquiries/types"

const label = "mb-1 block text-xs font-medium text-muted-foreground"
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean)

type DayRow = { title: string; description: string }
type HotelRow = { name: string; location: string; nights: string; roomType: string; mealPlan: string }

/**
 * Admin: build the final, customised quotation. Starts from the current quotation (when revising) or from the package
 * itself (itinerary + inclusions), so the admin only edits what the customer asked to change.
 */
export function QuotationBuilder({ enquiry, busy, onSubmit }: { enquiry: PackageEnquiry; busy: boolean; onSubmit: (input: QuotationInput) => void }) {
  const pkg = typeof enquiry.package === "object" ? enquiry.package : null
  const q = enquiry.quotation
  const travellers = enquiry.request.adults + enquiry.request.children
  const advancePossible = canOfferAdvance(enquiry.request.startDate)

  const [amount, setAmount] = useState(q ? String(q.amount) : "")
  const [validDays, setValidDays] = useState("7")
  const [days, setDays] = useState(String(q?.days ?? enquiry.request.days ?? pkg?.duration.days ?? ""))
  const [itinerary, setItinerary] = useState<DayRow[]>((q?.itinerary ?? pkg?.itinerary ?? []).map((d) => ({ title: d.title, description: d.description ?? "" })))
  const [hotels, setHotels] = useState<HotelRow[]>((q?.hotels ?? []).map((h) => ({ name: h.name, location: h.location ?? "", nights: h.nights ? String(h.nights) : "", roomType: h.roomType ?? "", mealPlan: h.mealPlan ?? "" })))
  const [activities, setActivities] = useState((q?.activities ?? []).join("\n"))
  const [transport, setTransport] = useState(q?.transport ?? "")
  const [inclusions, setInclusions] = useState((q?.inclusions ?? pkg?.included ?? []).join("\n"))
  const [exclusions, setExclusions] = useState((q?.exclusions ?? pkg?.excluded ?? []).join("\n"))
  const [note, setNote] = useState(q?.note ?? "")
  const [advanceAllowed, setAdvanceAllowed] = useState(Boolean(q?.advanceAllowed) && advancePossible)
  const [advancePercent, setAdvancePercent] = useState(String(q?.advancePercent ?? 30))

  const patchDay = (i: number, patch: Partial<DayRow>) => setItinerary((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const patchHotel = (i: number, patch: Partial<HotelRow>) => setHotels((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const price = Number(amount)
  const valid = price >= 1 && Number.isInteger(price)

  const submit = () => {
    const dayCount = Number(days) || undefined
    onSubmit({
      amount: price,
      validDays: Number(validDays) || undefined,
      days: dayCount,
      nights: dayCount ? Math.max(0, dayCount - 1) : undefined,
      itinerary: itinerary.filter((r) => r.title.trim()).map((r, i) => ({ day: i + 1, title: r.title.trim(), description: r.description.trim() || undefined })),
      hotels: hotels.filter((h) => h.name.trim()).map((h) => ({ name: h.name.trim(), location: h.location.trim() || undefined, nights: h.nights ? Number(h.nights) : undefined, roomType: h.roomType.trim() || undefined, mealPlan: h.mealPlan.trim() || undefined })),
      activities: lines(activities),
      transport: transport.trim() || undefined,
      inclusions: lines(inclusions),
      exclusions: lines(exclusions),
      note: note.trim() || undefined,
      advanceAllowed: advanceAllowed && advancePossible,
      advancePercent: advanceAllowed && advancePossible ? Number(advancePercent) : undefined,
    })
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="q-amount">Final package price for {travellers} traveller{travellers > 1 ? "s" : ""} (₹, before GST)</label>
          <Input id="q-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            GST is added automatically. Customer budget: {enquiry.request.budget?.amount ? `${formatINR(enquiry.request.budget.amount)} ${enquiry.request.budget.basis === "per_person" ? `per person (≈ ${formatINR(enquiry.request.budget.amount * travellers)} total)` : "total"}` : "not shared"}
            {pkg ? ` · Listed price ${formatINR(pkg.price)} per person (≈ ${formatINR(pkg.price * travellers)})` : ""}
          </p>
        </div>
        <div>
          <label className={label} htmlFor="q-valid">Valid for (days)</label>
          <Input id="q-valid" type="number" min={1} max={30} value={validDays} onChange={(e) => setValidDays(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="q-days">Trip length (days)</label>
        <Input id="q-days" type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} className="w-32" />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Itinerary</h4>
          <Button type="button" size="sm" variant="outline" onClick={() => setItinerary((r) => [...r, { title: "", description: "" }])}><Plus className="size-3.5" /> Add day</Button>
        </div>
        <div className="space-y-2">
          {itinerary.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[3.5rem_1fr_auto]">
              <span className="pt-1.5 text-xs font-semibold text-muted-foreground">Day {i + 1}</span>
              <div className="space-y-1.5">
                <Input aria-label={`Day ${i + 1} title`} value={row.title} onChange={(e) => patchDay(i, { title: e.target.value })} placeholder="Title, e.g. Arrive in Jaipur" />
                <Textarea aria-label={`Day ${i + 1} details`} value={row.description} onChange={(e) => patchDay(i, { description: e.target.value })} className="min-h-12" placeholder="What happens on this day" />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove day ${i + 1}`} onClick={() => setItinerary((r) => r.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {itinerary.length === 0 && <p className="text-xs text-muted-foreground">No itinerary yet - add the days of the customised trip.</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Hotels</h4>
          <Button type="button" size="sm" variant="outline" onClick={() => setHotels((r) => [...r, { name: "", location: "", nights: "", roomType: "", mealPlan: "" }])}><Plus className="size-3.5" /> Add hotel</Button>
        </div>
        <div className="space-y-2">
          {hotels.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2fr_1.2fr_5rem_1fr_1fr_auto]">
              <Input aria-label={`Hotel ${i + 1} name`} value={row.name} onChange={(e) => patchHotel(i, { name: e.target.value })} placeholder="Hotel name" />
              <Input aria-label={`Hotel ${i + 1} city`} value={row.location} onChange={(e) => patchHotel(i, { location: e.target.value })} placeholder="City" />
              <Input aria-label={`Hotel ${i + 1} nights`} type="number" min={0} value={row.nights} onChange={(e) => patchHotel(i, { nights: e.target.value })} placeholder="Nights" />
              <Input aria-label={`Hotel ${i + 1} room type`} value={row.roomType} onChange={(e) => patchHotel(i, { roomType: e.target.value })} placeholder="Room type" />
              <Input aria-label={`Hotel ${i + 1} meal plan`} value={row.mealPlan} onChange={(e) => patchHotel(i, { mealPlan: e.target.value })} placeholder="Meals" />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove hotel ${i + 1}`} onClick={() => setHotels((r) => r.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {hotels.length === 0 && <p className="text-xs text-muted-foreground">No hotels listed yet.</p>}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="q-acts">Activities (one per line)</label>
          <Textarea id="q-acts" value={activities} onChange={(e) => setActivities(e.target.value)} placeholder={"Desert safari\nCity palace tour"} />
        </div>
        <div>
          <label className={label} htmlFor="q-transport">Transport</label>
          <Input id="q-transport" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="e.g. Private AC sedan with driver" />
        </div>
        <div>
          <label className={label} htmlFor="q-inc">Included (one per line)</label>
          <Textarea id="q-inc" value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="q-exc">Not included (one per line)</label>
          <Textarea id="q-exc" value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="q-note">Message to the customer</label>
        <Textarea id="q-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Anything the customer should know about this offer" />
      </div>

      <div className="rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input type="checkbox" checked={advanceAllowed && advancePossible} disabled={!advancePossible} onChange={(e) => setAdvanceAllowed(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Also allow advance payment (balance due 7 days before the trip)
        </label>
        {!advancePossible && <p className="mt-1 text-xs text-muted-foreground">The trip starts too soon for an advance plan - the customer will pay in full.</p>}
        {advanceAllowed && advancePossible && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Advance</span>
            <Select aria-label="Advance percentage" value={advancePercent} onChange={(e) => setAdvancePercent(e.target.value)} className="w-24">
              {[10, 20, 25, 30, 40, 50, 60, 70, 80, 90].map((p) => <option key={p} value={p}>{p}%</option>)}
            </Select>
          </div>
        )}
      </div>

      {enquiry.status === "quotation_sent" && <Alert>A quotation is already with the customer. Sending again replaces it with a new version.</Alert>}

      <Button onClick={submit} disabled={busy || !valid} className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">
        {busy ? "Sending..." : q ? "Send revised quotation" : "Send final quotation"}
      </Button>
    </div>
  )
}
