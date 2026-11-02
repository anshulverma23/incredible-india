import { describe, expect, it } from "vitest"
import { canOfferAdvance, paymentOptions } from "@/features/enquiries/lib/payment-plan"
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLES, CUSTOMER_STATUS_LABEL, budgetLabel, isBookingPayable, isFuture, isOpenEnquiry } from "@/features/enquiries/lib/status"
import { isBalanceDue } from "@/features/bookings/lib/status"
import { formatCountdown } from "@/features/payments/hooks/useCountdown"

const daysFromNow = (n: number) => new Date(Date.now() + n * 864e5).toISOString()

describe("paymentOptions", () => {
  it("splits the total into advance + balance and sets the balance deadline 7 days before the trip", () => {
    const start = daysFromNow(40)
    const p = paymentOptions({ totalAmount: 52500, advanceAllowed: true, advancePercent: 30 }, start)
    expect(p.full).toBe(52500)
    expect(p.advance).toBe(15750)
    expect(p.balance).toBe(36750)
    expect(p.advance + p.balance).toBe(52500)
    expect(p.balanceDue.getTime()).toBe(new Date(start).getTime() - 7 * 864e5)
  })
  it("no advance when the quotation does not offer one", () => {
    expect(paymentOptions({ totalAmount: 1000, advanceAllowed: false }, daysFromNow(40)).advance).toBe(0)
  })
  it("offers an advance only when the trip is far enough away", () => {
    expect(canOfferAdvance(daysFromNow(30))).toBe(true)
    expect(canOfferAdvance(daysFromNow(5))).toBe(false)
  })
})

describe("enquiry status helpers", () => {
  it("every status has a label and a style", () => {
    for (const s of Object.keys(ENQUIRY_STATUS_LABEL) as (keyof typeof ENQUIRY_STATUS_LABEL)[]) {
      expect(ENQUIRY_STATUS_LABEL[s]).toBeTruthy()
      expect(CUSTOMER_STATUS_LABEL[s]).toBeTruthy()
      expect(ENQUIRY_STATUS_STYLES[s]).toBeTruthy()
    }
  })
  it("open vs closed", () => {
    expect(isOpenEnquiry("in_discussion")).toBe(true)
    expect(isOpenEnquiry("accepted")).toBe(true)
    expect(isOpenEnquiry("booked")).toBe(false)
    expect(isOpenEnquiry("rejected")).toBe(false)
  })
  it("budget label", () => {
    const fmt = (n: number) => `Rs ${n}`
    expect(budgetLabel({ request: { budget: { amount: 25000, basis: "per_person" } } } as never, fmt)).toBe("Rs 25000/person")
    expect(budgetLabel({ request: { budget: { amount: 90000, basis: "total" } } } as never, fmt)).toBe("Rs 90000 total")
    expect(budgetLabel({ request: {} } as never, fmt)).toBe("Not shared")
  })
  it("payable booking = pending and not expired", () => {
    expect(isBookingPayable({ bookingStatus: "pending", expiresAt: daysFromNow(1) })).toBe(true)
    expect(isBookingPayable({ bookingStatus: "pending", expiresAt: daysFromNow(-1) })).toBe(false)
    expect(isBookingPayable({ bookingStatus: "expired" })).toBe(false)
    expect(isBookingPayable(null)).toBe(false)
    expect(isFuture(undefined)).toBe(true)
  })
})

describe("advance plan helpers", () => {
  it("balance is due only after the advance and while confirmed", () => {
    const plan = { mode: "advance" }
    expect(isBalanceDue({ bookingStatus: "confirmed", paymentStatus: "partially_paid", paymentPlan: plan })).toBe(true)
    expect(isBalanceDue({ bookingStatus: "pending", paymentStatus: "pending", paymentPlan: plan })).toBe(false)
    expect(isBalanceDue({ bookingStatus: "confirmed", paymentStatus: "paid", paymentPlan: plan })).toBe(false)
    expect(isBalanceDue({ bookingStatus: "confirmed", paymentStatus: "partially_paid", paymentPlan: { mode: "full" } })).toBe(false)
  })
  it("long payment windows are shown in hours", () => {
    expect(formatCountdown(48 * 3600)).toBe("48h 00m")
    expect(formatCountdown(3600 + 125)).toBe("1h 02m")
    expect(formatCountdown(125)).toBe("02:05")
  })
})
