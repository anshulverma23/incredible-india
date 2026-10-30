import { describe, expect, it } from "vitest"
import { canApprovePrice, isPayable, isRequestStage } from "@/features/bookings/lib/status"
import { formatCountdown } from "@/features/payments/hooks/useCountdown"
import { timeAgo } from "@/features/notifications/lib/time-ago"

const future = () => new Date(Date.now() + 10 * 60_000).toISOString()
const past = () => new Date(Date.now() - 1000).toISOString()

describe("isPayable", () => {
  it("is true for a pending, unpaid booking whose hold is still running", () => {
    expect(isPayable({ bookingStatus: "pending", paymentStatus: "pending", expiresAt: future() })).toBe(true)
    expect(isPayable({ bookingStatus: "pending", paymentStatus: "failed", expiresAt: future() })).toBe(true) // retry after a failed attempt
  })
  it("is false once expired, paid, cancelled or confirmed", () => {
    expect(isPayable({ bookingStatus: "pending", paymentStatus: "pending", expiresAt: past() })).toBe(false)
    expect(isPayable({ bookingStatus: "pending", paymentStatus: "paid" })).toBe(false)
    expect(isPayable({ bookingStatus: "cancelled", paymentStatus: "pending" })).toBe(false)
    expect(isPayable({ bookingStatus: "confirmed", paymentStatus: "paid" })).toBe(false)
    expect(isPayable({ bookingStatus: "expired", paymentStatus: "pending" })).toBe(false)
  })
})

describe("formatters", () => {
  it("formats the hold countdown", () => {
    expect(formatCountdown(0)).toBe("00:00")
    expect(formatCountdown(125)).toBe("02:05")
    expect(formatCountdown(1799)).toBe("29:59")
  })
  it("formats relative times", () => {
    expect(timeAgo(new Date())).toBe("just now")
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe("5m ago")
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000))).toBe("3h ago")
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000))).toBe("2d ago")
  })
})

describe("hotel request statuses", () => {
  it("a request is never payable until the customer approved the price", () => {
    expect(isPayable({ bookingStatus: "pending_confirmation", paymentStatus: "pending", expiresAt: future() })).toBe(false)
    expect(isPayable({ bookingStatus: "awaiting_approval", paymentStatus: "pending", expiresAt: future() })).toBe(false)
    expect(isPayable({ bookingStatus: "pending", paymentStatus: "pending", expiresAt: future() })).toBe(true) // after approval
  })
  it("the price can be approved only while the offer is still valid", () => {
    expect(canApprovePrice({ bookingStatus: "awaiting_approval", expiresAt: future() })).toBe(true)
    expect(canApprovePrice({ bookingStatus: "awaiting_approval", expiresAt: past() })).toBe(false)
    expect(canApprovePrice({ bookingStatus: "pending_confirmation", expiresAt: future() })).toBe(false)
  })
  it("knows which statuses are still a request", () => {
    expect(isRequestStage({ bookingStatus: "pending_confirmation" })).toBe(true)
    expect(isRequestStage({ bookingStatus: "awaiting_approval" })).toBe(true)
    expect(isRequestStage({ bookingStatus: "declined" })).toBe(false)
    expect(isRequestStage({ bookingStatus: "confirmed" })).toBe(false)
  })
})
