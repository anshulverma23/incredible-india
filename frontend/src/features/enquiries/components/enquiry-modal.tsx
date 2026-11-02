import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { enquiryApi } from "@/features/enquiries/api/enquiry.api"
import { CONTACT_LABEL } from "@/features/enquiries/lib/status"
import { ApiError } from "@/lib/axios"
import { formatDate, formatINR } from "@/lib/utils"
import type { ContactMethod } from "@/features/enquiries/types"
import type { TourPackage } from "@/features/packages/types"

const label = "mb-1 block text-xs font-medium text-muted-foreground"
const today = () => new Date().toISOString().split("T")[0]

/** "Discuss This Package" form: the customer shares dates, travellers, budget and requirements. */
export function EnquiryModal({ pkg, open, onOpenChange }: { pkg: TourPackage; open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [startDate, setStartDate] = useState("")
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [days, setDays] = useState(pkg.duration.days)
  const [rooms, setRooms] = useState(1)
  const [budget, setBudget] = useState("")
  const [basis, setBasis] = useState<"per_person" | "total">("per_person")
  const [requirements, setRequirements] = useState("")
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email")
  const [phone, setPhone] = useState(user?.phone || "")
  const [error, setError] = useState("")
  const [existingId, setExistingId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const travellers = adults + children
  const needsPhone = contactMethod === "phone" || contactMethod === "whatsapp"

  const submit = async () => {
    setError("")
    setExistingId("")
    if (!startDate) return setError("Please choose your travel start date")
    if (needsPhone && phone.trim().length < 8) return setError("Please enter a phone number so we can reach you")
    setSubmitting(true)
    try {
      const { enquiry } = await enquiryApi.create({
        packageId: pkg._id,
        startDate,
        adults,
        children,
        days,
        rooms,
        budgetAmount: budget ? Number(budget) : undefined,
        budgetBasis: basis,
        requirements: requirements.trim() || undefined,
        contactMethod,
        phone: phone.trim() || undefined,
      })
      onOpenChange(false)
      navigate(`/enquiries/${enquiry._id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const id = (err.details as { enquiryId?: string } | undefined)?.enquiryId
        if (id) setExistingId(id)
      }
      setError(err instanceof ApiError ? err.message : "Could not send your enquiry")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Discuss this package</DialogTitle>
          <DialogDescription>Tell us what you need. Our team will contact you, customise the trip and send a personalised quotation. No payment now.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="text-xs text-muted-foreground">Package</p>
            <p className="font-semibold text-foreground">{pkg.name}</p>
            <p className="text-xs text-muted-foreground">{pkg.duration.days} Days · {pkg.duration.nights} Nights · from {formatINR(pkg.price)} per person</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <span>
                {error}{" "}
                {existingId && <Link to={`/enquiries/${existingId}`} className="font-semibold underline" onClick={() => onOpenChange(false)}>Open my enquiry</Link>}
              </span>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={label} htmlFor="enq-date">Travel start date</label>
              <Input id="enq-date" type="date" min={today()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={label} htmlFor="enq-days">Number of days</label>
              <Input id="enq-days" type="number" min={1} max={60} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <label className={label} htmlFor="enq-adults">Adults</label>
              <Select id="enq-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div>
              <label className={label} htmlFor="enq-children">Children</label>
              <Select id="enq-children" value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                {Array.from({ length: 11 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div>
              <label className={label} htmlFor="enq-rooms">Number of rooms</label>
              <Select id="enq-rooms" value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div>
              <label className={label} htmlFor="enq-contact">Preferred contact method</label>
              <Select id="enq-contact" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)}>
                {(Object.keys(CONTACT_LABEL) as ContactMethod[]).map((m) => <option key={m} value={m}>{CONTACT_LABEL[m]}</option>)}
              </Select>
            </div>
          </div>

          {needsPhone && (
            <div>
              <label className={label} htmlFor="enq-phone">Phone number</label>
              <Input id="enq-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <label className={label} htmlFor="enq-budget">Approximate budget (₹) - optional</label>
              <Input id="enq-budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 25000" />
            </div>
            <Select aria-label="Budget basis" value={basis} onChange={(e) => setBasis(e.target.value as "per_person" | "total")} className="w-36">
              <option value="per_person">per person</option>
              <option value="total">total</option>
            </Select>
          </div>

          <div>
            <label className={label} htmlFor="enq-req">Special requirements</label>
            <Textarea id="enq-req" value={requirements} onChange={(e) => setRequirements(e.target.value)} maxLength={2000} placeholder="e.g. Hotel with breakfast and private cab, vegetarian meals, anniversary trip..." />
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Your enquiry</p>
            <p>{pkg.name} · {startDate ? formatDate(startDate) : "date not chosen"} · {travellers} traveller{travellers > 1 ? "s" : ""} · {rooms} room{rooms > 1 ? "s" : ""}</p>
            {budget && <p>Budget: {formatINR(Number(budget))} {basis === "per_person" ? "per person" : "in total"}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? "Sending..." : "Send enquiry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
