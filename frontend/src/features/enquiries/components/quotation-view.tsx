
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

const lines = (text: string) =>
  text.split("\n").map((line) => line.trim()).filter(Boolean)

type DayRow = {
  title: string
  description: string
}

type HotelRow = {
  name: string
  location: string
  nights: string
  roomType: string
  mealPlan: string
}

/**
 * Admin quotation builder.
 * Creates or revises a customised quotation.
 */
export function QuotationBuilder({
  enquiry,
  busy,
  onSubmit,
}: {
  enquiry: PackageEnquiry
  busy: boolean
  onSubmit: (input: QuotationInput) => void
}) {
  const pkg = typeof enquiry.package === "object" ? enquiry.package : null
  const q = enquiry.quotation

  const travellers = enquiry.request.adults + enquiry.request.children
  const advancePossible = canOfferAdvance(enquiry.request.startDate)

  const [amount, setAmount] = useState(q ? String(q.amount) : "")
  const [validDays, setValidDays] = useState("7")

  const [days, setDays] = useState(
    String(q?.days ?? enquiry.request.days ?? pkg?.duration.days ?? "")
  )

  const [itinerary, setItinerary] = useState<DayRow[]>(
    (q?.itinerary ?? pkg?.itinerary ?? []).map((day) => ({
      title: day.title,
      description: day.description ?? "",
    }))
  )

  const [hotels, setHotels] = useState<HotelRow[]>(
    (q?.hotels ?? []).map((hotel) => ({
      name: hotel.name,
      location: hotel.location ?? "",
      nights: hotel.nights ? String(hotel.nights) : "",
      roomType: hotel.roomType ?? "",
      mealPlan: hotel.mealPlan ?? "",
    }))
  )

  const [activities, setActivities] = useState(
    (q?.activities ?? []).join("\n")
  )

  const [transport, setTransport] = useState(q?.transport ?? "")

  const [inclusions, setInclusions] = useState(
    (q?.inclusions ?? pkg?.included ?? []).join("\n")
  )

  const [exclusions, setExclusions] = useState(
    (q?.exclusions ?? pkg?.excluded ?? []).join("\n")
  )

  const [note, setNote] = useState(q?.note ?? "")

  const [advanceAllowed, setAdvanceAllowed] = useState(
    Boolean(q?.advanceAllowed) && advancePossible
  )

  const [advancePercent, setAdvancePercent] = useState(
    String(q?.advancePercent ?? 30)
  )

  const patchDay = (index: number, patch: Partial<DayRow>) => {
    setItinerary((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      )
    )
  }

  const patchHotel = (index: number, patch: Partial<HotelRow>) => {
    setHotels((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      )
    )
  }

  const price = Number(amount)
  const valid = price >= 1 && Number.isInteger(price)

  const submit = () => {
    const dayCount = Number(days) || undefined

    onSubmit({
      amount: price,
      validDays: Number(validDays) || undefined,
      days: dayCount,
      nights: dayCount ? Math.max(0, dayCount - 1) : undefined,

      itinerary: itinerary
        .filter((row) => row.title.trim())
        .map((row, index) => ({
          day: index + 1,
          title: row.title.trim(),
          description: row.description.trim() || undefined,
        })),

      hotels: hotels
        .filter((hotel) => hotel.name.trim())
        .map((hotel) => ({
          name: hotel.name.trim(),
          location: hotel.location.trim() || undefined,
          nights: hotel.nights ? Number(hotel.nights) : undefined,
          roomType: hotel.roomType.trim() || undefined,
          mealPlan: hotel.mealPlan.trim() || undefined,
        })),

      activities: lines(activities),
      transport: transport.trim() || undefined,
      inclusions: lines(inclusions),
      exclusions: lines(exclusions),
      note: note.trim() || undefined,

      advanceAllowed: advanceAllowed && advancePossible,

      advancePercent:
        advanceAllowed && advancePossible
          ? Number(advancePercent)
          : undefined,
    })
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="q-amount">
            Final package price for {travellers} traveller
            {travellers > 1 ? "s" : ""} (₹, before GST)
          </label>

          <Input
            id="q-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000"
          />

          <p className="mt-1 text-[11px] text-muted-foreground">
            GST is added automatically. Customer budget:{" "}
            {enquiry.request.budget?.amount
              ? `${formatINR(enquiry.request.budget.amount)} ${
                  enquiry.request.budget.basis === "per_person"
                    ? `per person (≈ ${formatINR(
                        enquiry.request.budget.amount * travellers
                      )} total)`
                    : "total"
                }`
              : "not shared"}

            {pkg
              ? ` · Listed price ${formatINR(pkg.price)} per person (≈ ${formatINR(
                  pkg.price * travellers
                )})`
              : ""}
          </p>
        </div>

        <div>
          <label className={label} htmlFor="q-valid">
            Valid for (days)
          </label>

          <Input
            id="q-valid"
            type="number"
            min={1}
            max={30}
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="q-days">
          Trip length (days)
        </label>

        <Input
          id="q-days"
          type="number"
          min={1}
          max={60}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-32"
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Itinerary</h4>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setItinerary((rows) => [
                ...rows,
                { title: "", description: "" },
              ])
            }
          >
            <Plus className="size-3.5" />
            Add day
          </Button>
        </div>

        <div className="space-y-2">
          {itinerary.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[3.5rem_1fr_auto]"
            >
              <span className="pt-1.5 text-xs font-semibold text-muted-foreground">
                Day {index + 1}
              </span>

              <div className="space-y-1.5">
                <Input
                  aria-label={`Day ${index + 1} title`}
                  value={row.title}
                  onChange={(e) =>
                    patchDay(index, { title: e.target.value })
                  }
                  placeholder="Title, e.g. Arrive in Jaipur"
                />

                <Textarea
                  aria-label={`Day ${index + 1} details`}
                  value={row.description}
                  onChange={(e) =>
                    patchDay(index, { description: e.target.value })
                  }
                  className="min-h-12"
                  placeholder="What happens on this day"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove day ${index + 1}`}
                onClick={() =>
                  setItinerary((rows) =>
                    rows.filter((_, i) => i !== index)
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          {itinerary.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No itinerary yet - add the days of the customised trip.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Hotels</h4>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setHotels((rows) => [
                ...rows,
                {
                  name: "",
                  location: "",
                  nights: "",
                  roomType: "",
                  mealPlan: "",
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Add hotel
          </Button>
        </div>

        <div className="space-y-2">
          {hotels.map((row, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[2fr_1.2fr_5rem_1fr_1fr_auto]"
            >
              <Input
                aria-label={`Hotel ${index + 1} name`}
                value={row.name}
                onChange={(e) =>
                  patchHotel(index, { name: e.target.value })
                }
                placeholder="Hotel name"
              />

              <Input
                aria-label={`Hotel ${index + 1} city`}
                value={row.location}
                onChange={(e) =>
                  patchHotel(index, { location: e.target.value })
                }
                placeholder="City"
              />

              <Input
                aria-label={`Hotel ${index + 1} nights`}
                type="number"
                min={0}
                value={row.nights}
                onChange={(e) =>
                  patchHotel(index, { nights: e.target.value })
                }
                placeholder="Nights"
              />

              <Input
                aria-label={`Hotel ${index + 1} room type`}
                value={row.roomType}
                onChange={(e) =>
                  patchHotel(index, { roomType: e.target.value })
                }
                placeholder="Room type"
              />

              <Input
                aria-label={`Hotel ${index + 1} meal plan`}
                value={row.mealPlan}
                onChange={(e) =>
                  patchHotel(index, { mealPlan: e.target.value })
                }
                placeholder="Meals"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove hotel ${index + 1}`}
                onClick={() =>
                  setHotels((rows) =>
                    rows.filter((_, i) => i !== index)
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          {hotels.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hotels listed yet.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="q-acts">
            Activities (one per line)
          </label>

          <Textarea
            id="q-acts"
            value={activities}
            onChange={(e) => setActivities(e.target.value)}
            placeholder={"Desert safari\nCity palace tour"}
          />
        </div>

        <div>
          <label className={label} htmlFor="q-transport">
            Transport
          </label>

          <Input
            id="q-transport"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            placeholder="e.g. Private AC sedan with driver"
          />
        </div>

        <div>
          <label className={label} htmlFor="q-inc">
            Included (one per line)
          </label>

          <Textarea
            id="q-inc"
            value={inclusions}
            onChange={(e) => setInclusions(e.target.value)}
          />
        </div>

        <div>
          <label className={label} htmlFor="q-exc">
            Not included (one per line)
          </label>

          <Textarea
            id="q-exc"
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="q-note">
          Message to the customer
        </label>

        <Textarea
          id="q-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Anything the customer should know about this offer"
        />
      </div>

      <div className="rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={advanceAllowed && advancePossible}
            disabled={!advancePossible}
            onChange={(e) => setAdvanceAllowed(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />

          Also allow advance payment (balance due 7 days before the trip)
        </label>

        {!advancePossible && (
          <p className="mt-1 text-xs text-muted-foreground">
            The trip starts too soon for an advance plan - the customer will pay in full.
          </p>
        )}

        {advanceAllowed && advancePossible && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Advance
            </span>

            <Select
              aria-label="Advance percentage"
              value={advancePercent}
              onChange={(e) => setAdvancePercent(e.target.value)}
              className="w-24"
            >
              {[10, 20, 25, 30, 40, 50, 60, 70, 80, 90].map((percent) => (
                <option key={percent} value={percent}>
                  {percent}%
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {enquiry.status === "quotation_sent" && (
        <Alert>
          A quotation is already with the customer. Sending again replaces it with a new version.
        </Alert>
      )}

      <Button
        onClick={submit}
        disabled={busy || !valid}
        className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90"
      >
        {busy
          ? "Sending..."
          : q
            ? "Send revised quotation"
            : "Send final quotation"}
      </Button>
    </div>
  )
}

/**
 * Read-only quotation view.
 * Compatible with existing AdminEnquiryDetail and EnquiryDetail pages.
 */
export function QuotationView({
  quotation,
  request,
  expired,
}: {
  quotation: NonNullable<PackageEnquiry["quotation"]> | null
  request: PackageEnquiry["request"]
  expired?: boolean
}) {
  if (!quotation) {
    return (
      <Alert>
        No quotation has been sent for this enquiry yet.
      </Alert>
    )
  }

  const travellers = request.adults + request.children

  return (
    <div className="space-y-5 text-sm">
      {expired && (
        <Alert>
          This quotation has expired. Please contact our team for an updated quotation.
        </Alert>
      )}

      <div className="rounded-xl border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Final package price
        </p>

        <p className="mt-1 text-2xl font-bold text-foreground">
          {formatINR(quotation.amount)}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          For {travellers} traveller{travellers !== 1 ? "s" : ""}
        </p>

        {quotation.days && (
          <p className="mt-1 text-xs text-muted-foreground">
            {quotation.days} days
            {quotation.nights != null
              ? ` · ${quotation.nights} nights`
              : ""}
          </p>
        )}
      </div>

      {quotation.itinerary?.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold text-foreground">
            Trip itinerary
          </h3>

          <div className="space-y-3">
            {quotation.itinerary.map((day, index) => (
              <div
                key={index}
                className="rounded-lg border border-border p-3"
              >
                <p className="font-semibold text-foreground">
                  Day {day.day ?? index + 1}: {day.title}
                </p>

                {day.description && (
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {day.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {quotation.hotels?.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold text-foreground">
            Accommodation
          </h3>

          <div className="space-y-2">
            {quotation.hotels.map((hotel, index) => (
              <div
                key={index}
                className="rounded-lg border border-border p-3"
              >
                <p className="font-semibold text-foreground">
                  {hotel.name}
                </p>

                {hotel.location && (
                  <p className="text-muted-foreground">
                    {hotel.location}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {hotel.nights != null && (
                    <span>{hotel.nights} nights</span>
                  )}

                  {hotel.roomType && <span>{hotel.roomType}</span>}

                  {hotel.mealPlan && <span>{hotel.mealPlan}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {quotation.activities?.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-foreground">
            Activities
          </h3>

          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {quotation.activities.map((activity, index) => (
              <li key={index}>{activity}</li>
            ))}
          </ul>
        </section>
      )}

      {quotation.transport && (
        <section>
          <h3 className="mb-1 font-semibold text-foreground">
            Transport
          </h3>

          <p className="text-muted-foreground">
            {quotation.transport}
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {quotation.inclusions?.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold text-foreground">
              Included
            </h3>

            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {quotation.inclusions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {quotation.exclusions?.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold text-foreground">
              Not included
            </h3>

            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {quotation.exclusions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {quotation.advanceAllowed && (
        <div className="rounded-lg border border-border p-3">
          <p className="font-semibold text-foreground">
            Advance payment available
          </p>

          <p className="mt-1 text-muted-foreground">
            {quotation.advancePercent}% advance payment is allowed.
            Remaining balance is due 7 days before the trip.
          </p>
        </div>
      )}

      {quotation.note && (
        <div className="rounded-lg border border-border p-3">
          <h3 className="mb-1 font-semibold text-foreground">
            Message from our team
          </h3>

          <p className="whitespace-pre-line text-muted-foreground">
            {quotation.note}
          </p>
        </div>
      )}
    </div>
  )
}
