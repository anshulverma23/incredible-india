import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import CheckoutPage from "@/features/payments/pages/Checkout"
import { ApiError } from "@/lib/axios"

vi.mock("@/features/auth/hooks/useAuth", () => ({ useAuth: () => ({ user: { _id: "u1", name: "Asha", email: "asha@test.dev", role: "user" } }) }))
vi.mock("@/features/payments/api/razorpay", () => ({ loadRazorpayScript: vi.fn().mockResolvedValue(true) }))
vi.mock("@/features/bookings/api/booking.api", () => ({ bookingApi: { get: vi.fn(), applyCoupon: vi.fn() } }))
vi.mock("@/features/payments/api/payment.api", () => ({ paymentApi: { createRazorpayOrder: vi.fn(), verifyRazorpay: vi.fn(), reportFailure: vi.fn() } }))

import { bookingApi } from "@/features/bookings/api/booking.api"
import { paymentApi } from "@/features/payments/api/payment.api"

const booking = (over = {}) => ({
  _id: "b1",
  bookingReference: "IT-260607-K7M2QX",
  bookingType: "package",
  package: { name: "Kashmir Tour" },
  travelDate: "2026-12-01T00:00:00.000Z",
  guests: { adults: 2, children: 0 },
  pricing: { basePrice: 20000, discount: 0, tax: 1000, totalAmount: 21000 },
  paymentStatus: "pending",
  bookingStatus: "pending",
  expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
  ...over,
})

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/checkout/b1"]}>
      <Where />
      <Routes>
        <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
        <Route path="/payment-success/:bookingId" element={<div>SUCCESS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )

// A fake Razorpay Checkout: the test decides whether the customer pays or the payment fails.
type Opts = { handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void }
let listeners: Record<string, (r: unknown) => void> = {}
let lastOpts: Opts
beforeEach(() => {
  vi.clearAllMocks()
  listeners = {}
  ;(window as unknown as { Razorpay: unknown }).Razorpay = class {
    constructor(opts: Opts) {
      lastOpts = opts
    }
    on(ev: string, cb: (r: unknown) => void) {
      listeners[ev] = cb
    }
    open() {}
  }
  vi.mocked(paymentApi.reportFailure).mockResolvedValue(undefined)
  vi.mocked(paymentApi.createRazorpayOrder).mockResolvedValue({ orderId: "order_1", amount: 2100000, currency: "INR", keyId: "rzp_test" })
})

describe("Checkout", () => {
  it("shows the summary, the hold timer and the exact total to pay", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking() } as never)
    renderPage()
    expect(await screen.findByText("Checkout")).toBeInTheDocument()
    expect(screen.getByText(/Your seats are held for/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pay ₹21,000/ })).toBeEnabled()
  })

  it("an expired hold cannot be paid", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking({ expiresAt: new Date(Date.now() - 1000).toISOString() }) } as never)
    renderPage()
    expect(await screen.findByText("This booking has expired")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pay/ })).not.toBeInTheDocument()
  })

  it("an already-paid booking is redirected to the success page", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking({ paymentStatus: "paid", bookingStatus: "confirmed" }) } as never)
    renderPage()
    expect(await screen.findByText("SUCCESS PAGE")).toBeInTheDocument()
  })

  it("a successful payment is sent to the SERVER for verification before the user sees success", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking() } as never)
    vi.mocked(paymentApi.verifyRazorpay).mockResolvedValue({ booking: booking({ paymentStatus: "paid" }) } as never)
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Pay ₹21,000/ }))
    await waitFor(() => expect(paymentApi.createRazorpayOrder).toHaveBeenCalledWith("b1"))
    expect(screen.queryByText("SUCCESS PAGE")).not.toBeInTheDocument() // closing the popup alone proves nothing

    const razorpayResponse = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" }
    await lastOpts.handler(razorpayResponse)
    expect(paymentApi.verifyRazorpay).toHaveBeenCalledWith(razorpayResponse)
    expect(await screen.findByText("SUCCESS PAGE")).toBeInTheDocument()
  })

  it("a signature failure on the server keeps the user on checkout with an error", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking() } as never)
    vi.mocked(paymentApi.verifyRazorpay).mockRejectedValue(new ApiError("Payment verification failed - signature mismatch", 400))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Pay ₹21,000/ }))
    await waitFor(() => expect(lastOpts).toBeDefined())
    await lastOpts.handler({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_x", razorpay_signature: "forged" })
    expect(await screen.findByText(/signature mismatch/)).toBeInTheDocument()
    expect(screen.queryByText("SUCCESS PAGE")).not.toBeInTheDocument()
  })

  it("a declined payment shows the reason, reports the failure and lets the user retry", async () => {
    vi.mocked(bookingApi.get).mockResolvedValue({ booking: booking() } as never)
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /Pay ₹21,000/ }))
    await waitFor(() => expect(listeners["payment.failed"]).toBeDefined())
    listeners["payment.failed"]({ error: { description: "Your card was declined" } })
    expect(await screen.findByText(/Your card was declined/)).toBeInTheDocument()
    expect(paymentApi.reportFailure).toHaveBeenCalledWith("order_1", "Your card was declined")
    await waitFor(() => expect(screen.getByRole("button", { name: /Pay ₹21,000/ })).toBeEnabled())
  })
})
