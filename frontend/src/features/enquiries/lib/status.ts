import type { ContactMethod, EnquiryStatus, PackageEnquiry } from "@/features/enquiries/types"

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New enquiry",
  in_discussion: "Negotiation ongoing",
  quotation_sent: "Awaiting customer approval",
  revision_requested: "Changes requested",
  counter_offered: "Counter-offer received",
  accepted: "Accepted - awaiting payment",
  booked: "Booked",
  rejected: "Closed by us",
  cancelled: "Cancelled",
}

/** Wording for the customer ("awaiting customer approval" reads odd when you ARE the customer). */
export const CUSTOMER_STATUS_LABEL: Record<EnquiryStatus, string> = {
  ...ENQUIRY_STATUS_LABEL,
  new: "Enquiry sent",
  in_discussion: "In discussion",
  quotation_sent: "Quotation ready - review it",
  counter_offered: "Your offer is with us",
}

export const ENQUIRY_STATUS_STYLES: Record<EnquiryStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  in_discussion: "bg-sky-100 text-sky-800",
  quotation_sent: "bg-violet-100 text-violet-800",
  revision_requested: "bg-orange-100 text-orange-800",
  counter_offered: "bg-pink-100 text-pink-800",
  accepted: "bg-yellow-100 text-yellow-800",
  booked: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
}

export const CONTACT_LABEL: Record<ContactMethod, string> = { email: "Email", phone: "Phone call", whatsapp: "WhatsApp", chat: "Chat on this website" }

export const ENQUIRY_FILTERS: { value: EnquiryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_discussion", label: "In discussion" },
  { value: "revision_requested", label: "Changes requested" },
  { value: "counter_offered", label: "Counter-offers" },
  { value: "quotation_sent", label: "Quotation sent" },
  { value: "accepted", label: "Awaiting payment" },
  { value: "booked", label: "Booked" },
  { value: "rejected", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
]

export const isOpenEnquiry = (s: EnquiryStatus) => !["booked", "rejected", "cancelled"].includes(s)

export const packageName = (e: Pick<PackageEnquiry, "package">) => (typeof e.package === "object" ? e.package.name : "Tour package")
export const packageSlug = (e: Pick<PackageEnquiry, "package">) => (typeof e.package === "object" ? e.package.slug || e.package._id : String(e.package))

/** Customer budget as shown to the admin, e.g. "Rs 25,000/person". */
export const budgetLabel = (e: Pick<PackageEnquiry, "request">, format: (n: number) => string) => {
  const b = e.request.budget
  return b?.amount ? `${format(b.amount)}${b.basis === "per_person" ? "/person" : " total"}` : "Not shared"
}

/** True while `iso` is in the future (or missing = no deadline). Kept out of components: render must stay pure. */
export const isFuture = (iso?: string) => !iso || new Date(iso).getTime() > Date.now()

/** An accepted quotation's booking that the customer can still pay. */
export const isBookingPayable = (b: { bookingStatus: string; expiresAt?: string } | null) => Boolean(b && b.bookingStatus === "pending" && isFuture(b.expiresAt))
