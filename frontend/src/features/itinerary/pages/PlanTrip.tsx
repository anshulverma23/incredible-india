import { useEffect, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Sparkles, Wallet, MapPin, Clock, Hotel, Package, Save, Trash2, AlertTriangle, CheckCircle2, Route } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { cn, formatINR } from "@/lib/utils"
import { ApiError } from "@/lib/axios"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { itineraryApi } from "@/features/itinerary/api/itinerary.api"
import { packagePath } from "@/features/packages/lib/package-path"
import type { ItineraryInput, ItineraryPlan, PlannableDestination, SavedItinerary } from "@/features/itinerary/types"

const INTERESTS = ["Adventure", "Nature", "Culture", "Heritage", "Spiritual", "Food", "Relaxation", "Shopping"]
const PACES = [
  { value: "relaxed", label: "Relaxed (1 activity/day)" },
  { value: "balanced", label: "Balanced (2 activities/day)" },
  { value: "packed", label: "Packed (3 activities/day)" },
] as const
const TIER_LABEL = { budget: "Budget stay", standard: "Comfortable stay", luxury: "Luxury stay" } as const

export default function PlanTripPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [searchParams] = useSearchParams()
  const presetDestination = searchParams.get("destination") || ""
  const [destinations, setDestinations] = useState<PlannableDestination[]>([])
  const [form, setForm] = useState<ItineraryInput>({ destination: presetDestination, days: 5, budget: 40000, travellers: 2, interests: ["Adventure", "Nature"], pace: "balanced" })
  const [plan, setPlan] = useState<ItineraryPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SavedItinerary[]>([])

  useEffect(() => {
    itineraryApi
      .destinations()
      .then(({ destinations }) => {
        setDestinations(destinations)
        setForm((f) => (f.destination || !destinations[0] ? f : { ...f, destination: destinations[0].name }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    itineraryApi
      .mine()
      .then(({ itineraries }) => setSaved(itineraries))
      .catch(() => {})
  }, [user])

  const toggleInterest = (i: string) =>
    setForm((f) => ({ ...f, interests: f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i] }))

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setGenerating(true)
    try {
      const { itinerary } = await itineraryApi.generate(form)
      setPlan(itinerary)
      setTimeout(() => document.getElementById("plan-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch (err) {
      setPlan(null)
      setError(err instanceof ApiError ? err.message : "Could not generate your itinerary")
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!plan) return
    setSaving(true)
    try {
      const { itinerary } = await itineraryApi.save(form, plan)
      setSaved((s) => [itinerary, ...s])
      toast("Itinerary saved to your account")
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save itinerary", "error")
    } finally {
      setSaving(false)
    }
  }

  const removeSaved = async (id: string) => {
    await itineraryApi.remove(id).catch(() => {})
    setSaved((s) => s.filter((x) => x._id !== id))
  }

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium uppercase tracking-widest text-accent"><Sparkles className="size-4" /> Trip Planner</p>
          <h1 className="font-manrope text-3xl font-bold text-foreground md:text-4xl">Plan my trip</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tell us where, how long and how much. We'll build a day-by-day route that fits your budget and interests - then match it with real packages and hotels you can book.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Card className="h-fit p-5 lg:col-span-1">
            <form onSubmit={generate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Destination</label>
                {destinations.length > 0 ? (
                  <Select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                    {destinations.map((d) => (
                      <option key={d._id} value={d.name}>{d.name} - {d.state}</option>
                    ))}
                  </Select>
                ) : (
                  <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. Kashmir" required />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Days</label>
                  <Input type="number" min={1} max={15} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Travellers</label>
                  <Input type="number" min={1} max={20} value={form.travellers} onChange={(e) => setForm({ ...form, travellers: Number(e.target.value) })} required />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Wallet className="size-3" /> Total budget (₹, whole group)</label>
                <Input type="number" min={1000} step={1000} value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} required />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => toggleInterest(i)}
                      aria-pressed={form.interests.includes(i)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        form.interests.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary",
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pace</label>
                <Select value={form.pace} onChange={(e) => setForm({ ...form, pace: e.target.value as ItineraryInput["pace"] })}>
                  {PACES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </div>

              {error && <Alert variant="destructive">{error}</Alert>}

              <Button type="submit" disabled={generating} className="w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">
                {generating ? "Planning your trip..." : "Create my itinerary"}
              </Button>
            </form>

            {user && saved.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Saved itineraries</p>
                <ul className="space-y-1.5">
                  {saved.map((s) => (
                    <li key={s._id} className="flex items-center justify-between gap-2 text-sm">
                      <button
                        className="truncate text-left text-primary hover:underline"
                        onClick={() => {
                          setForm(s.input)
                          setPlan(s.plan)
                        }}
                      >
                        {s.title}
                      </button>
                      <button onClick={() => removeSaved(s._id)} aria-label="Delete saved itinerary" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <div className="lg:col-span-2" id="plan-result">
            {!plan ? (
              <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                <Route className="mb-3 size-10 text-primary/60" />
                Your day-by-day plan will appear here.
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-2xl font-bold text-foreground">{plan.summary.days}-day {plan.destination.name} trip</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {plan.route.join(" → ")}
                      </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary">{TIER_LABEL[plan.summary.tier]}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Estimated total" value={formatINR(plan.summary.estimatedTotal)} />
                    <Stat label="Per person" value={formatINR(plan.summary.perPerson)} />
                    <Stat label="Your budget" value={formatINR(plan.summary.budget)} />
                    <Stat label={plan.summary.withinBudget ? "Left in budget" : "Over budget by"} value={formatINR(plan.summary.withinBudget ? plan.summary.remaining : plan.summary.shortfall)} tone={plan.summary.withinBudget ? "good" : "bad"} />
                  </div>

                  {plan.summary.withinBudget ? (
                    <p className="mt-4 flex items-center gap-1.5 text-sm text-primary"><CheckCircle2 className="size-4" /> This plan fits your budget.</p>
                  ) : (
                    plan.notes.map((n) => <Alert key={n} variant="destructive" className="mt-4"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {n}</Alert>)
                  )}
                  {plan.droppedForBudget.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Left out to stay in budget: {plan.droppedForBudget.join(", ")}.</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Break label="Stay" amount={plan.breakdown.stay} />
                    <Break label="Food" amount={plan.breakdown.food} />
                    <Break label="Local transport" amount={plan.breakdown.localTransport} />
                    <Break label="Activities" amount={plan.breakdown.activities} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user ? (
                      <Button variant="outline" onClick={save} disabled={saving}><Save className="mr-2 size-4" /> {saving ? "Saving..." : "Save itinerary"}</Button>
                    ) : (
                      <Button variant="outline" render={<Link to="/login" />}>Log in to save</Button>
                    )}
                  </div>
                </Card>

                <div className="space-y-3">
                  {plan.days.map((d) => (
                    <Card key={d.day} className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif font-bold text-primary">{d.day}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">{d.title}</p>
                            <span className="text-xs text-muted-foreground">≈ {formatINR(d.estimatedCost)} for the group</span>
                          </div>
                          {d.stay && <p className="text-xs text-muted-foreground">Overnight in {d.stay}</p>}
                          <ul className="mt-3 space-y-2">
                            {d.activities.length === 0 && <li className="text-sm text-muted-foreground">Free day - explore at your own pace.</li>}
                            {d.activities.map((a) => (
                              <li key={a.name} className="rounded-lg bg-muted/60 p-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-foreground">{a.name}</span>
                                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Clock className="size-3" /> ~{a.durationHours}h{a.timeOfDay !== "any" ? ` · ${a.timeOfDay}` : ""}</span>
                                    <span>{a.estimatedCost ? `${formatINR(a.estimatedCost)}/person` : "Free"}</span>
                                  </span>
                                </div>
                                {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {(plan.suggestions.packages.length > 0 || plan.suggestions.hotels.length > 0) && (
                  <Card className="p-5">
                    <h3 className="mb-3 font-semibold text-foreground">Book this trip</h3>
                    {plan.suggestions.packages.length > 0 && (
                      <div className="mb-4">
                        <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Package className="size-4" /> Ready-made packages within your budget</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {plan.suggestions.packages.map((p) => (
                            <Link key={p._id} to={packagePath(p)} className="rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary">
                              <p className="font-medium text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.duration.days}D/{p.duration.nights}N · {p.packageType} · {formatINR(p.price)}/person</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.suggestions.hotels.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Hotel className="size-4" /> Hotels for your stay</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {plan.suggestions.hotels.map((h) => (
                            <Link key={h._id} to={`/hotels/${h._id}`} className="rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary">
                              <p className="font-medium text-foreground">{h.name}</p>
                              <p className="text-xs text-muted-foreground">{h.location.city} · {h.hotelType}{h.fromPrice ? ` · from ${formatINR(h.fromPrice)}/night` : ""}</p>
                              {h.overBudgetBy ? <p className="mt-0.5 text-[11px] text-destructive">≈ {formatINR(h.overBudgetBy)} over your stay budget</p> : null}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-semibold text-foreground", tone === "good" && "text-primary", tone === "bad" && "text-destructive")}>{value}</p>
    </div>
  )
}

function Break({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{formatINR(amount)}</span>
    </div>
  )
}
