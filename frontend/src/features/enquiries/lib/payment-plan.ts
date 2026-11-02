import type { Quotation } from "@/features/enquiries/types"

/** Keep in sync with PACKAGE_ENQUIRY.balanceDueDaysBeforeTrip in backend/config/policy.js */
export const BALANCE_DUE_DAYS_BEFORE_TRIP = 7

/** What the customer pays now / later for each payment option of a quotation (whole rupees, same rounding as the server). */
export const paymentOptions = (q: Pick<Quotation, "totalAmount" | "advanceAllowed" | "advancePercent">, startDate: string) => {
  const advance = q.advanceAllowed && q.advancePercent ? Math.round((q.totalAmount * q.advancePercent) / 100) : 0
  const due = new Date(new Date(startDate).getTime() - BALANCE_DUE_DAYS_BEFORE_TRIP * 864e5)
  return { full: q.totalAmount, advance, balance: q.totalAmount - advance, balanceDue: due }
}

/** Mirrors the server rule: an advance plan needs the trip to be far enough away for the balance deadline. */
export const canOfferAdvance = (startDate: string) => new Date(startDate).getTime() - Date.now() > (BALANCE_DUE_DAYS_BEFORE_TRIP + 2) * 864e5
