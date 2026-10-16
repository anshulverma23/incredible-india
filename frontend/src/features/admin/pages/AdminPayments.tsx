import { useState } from "react"
import { Eye, RefreshCw } from "lucide-react"

import PaymentStats from "../components/payment-stats"
import PaymentFilters from "../components/payment-filters"
import PaymentDetails from "../components/payment-details"
import RefundModal from "../components/refund-modal"

import { refundPayment } from "../api/payments.api"
import { usePayments } from "../hooks/usePayments"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Payment } from "../types/payment"

const formatCurrency = (
  amount: number,
  currency = "INR"
) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0)

const statusClass = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700"

    case "pending":
    case "created":
      return "bg-yellow-100 text-yellow-700"

    case "failed":
      return "bg-red-100 text-red-700"

    case "refunded":
    case "partially_refunded":
      return "bg-purple-100 text-purple-700"

    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getCustomerName = (payment: Payment) => {
  if (
    typeof payment.user === "object" &&
    payment.user
  ) {
    return payment.user.name || "Unknown"
  }

  return "Unknown"
}

const getCustomerEmail = (payment: Payment) => {
  if (
    typeof payment.user === "object" &&
    payment.user
  ) {
    return payment.user.email || "-"
  }

  return "-"
}

const getBookingReference = (payment: Payment) => {
  if (
    typeof payment.booking === "object" &&
    payment.booking
  ) {
    return (
      payment.booking.bookingReference ||
      payment.booking._id
    )
  }

  return payment.booking
}

export default function AdminPayments() {
  const {
    payments,
    stats,
    filters,
    pagination,
    loading,
    statsLoading,
    error,
    updateFilters,
    refresh,
  } = usePayments()

  const [selectedPayment, setSelectedPayment] =
    useState<Payment | null>(null)

  const [refundPaymentData, setRefundPaymentData] =
    useState<Payment | null>(null)

  const [refundLoading, setRefundLoading] =
    useState(false)

  const handleRefund = async (
    amount: number | undefined,
    reason: string
  ) => {
    if (!refundPaymentData) return

    try {
      setRefundLoading(true)

      await refundPayment(
        refundPaymentData._id,
        {
          amount,
          reason,
        }
      )

      setRefundPaymentData(null)
      setSelectedPayment(null)

      await refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Refund failed")
    } finally {
      setRefundLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Manage Payments
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor all customer payments.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 size-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      </div>

      {/* Payment Stats */}
      <PaymentStats
        stats={stats}
        loading={statsLoading}
      />

      {/* Filters */}
      <div className="mt-6">
        <PaymentFilters
          filters={filters}
          onChange={updateFilters}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Payments Table */}
      <div className="mt-6 overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Payment
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Customer
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Booking
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Gateway
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Amount
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Status
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Date
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment._id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    {/* Payment */}
                    <td className="px-4 py-3">
                      <p className="max-w-[150px] truncate text-sm font-medium text-foreground">
                        {payment._id}
                      </p>

                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {payment.gateway}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {getCustomerName(payment)}
                      </p>

                      <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {getCustomerEmail(payment)}
                      </p>
                    </td>

                    {/* Booking */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">
                        {getBookingReference(payment)}
                      </span>
                    </td>

                    {/* Gateway */}
                    <td className="px-4 py-3">
                      <span className="text-sm capitalize text-foreground">
                        {payment.gateway}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap text-sm font-medium text-foreground">
                        {formatCurrency(
                          payment.amount,
                          payment.currency
                        )}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        className={`capitalize ${statusClass(
                          payment.status
                        )}`}
                      >
                        {payment.status.replaceAll(
                          "_",
                          " "
                        )}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                      {new Date(
                        payment.createdAt
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setSelectedPayment(payment)
                        }
                        title="View payment"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of{" "}
              {pagination.totalPages}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !pagination.hasPreviousPage
                }
                onClick={() =>
                  updateFilters({
                    page: pagination.page - 1,
                  })
                }
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() =>
                  updateFilters({
                    page: pagination.page + 1,
                  })
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Details */}
      {selectedPayment && (
        <PaymentDetails
          payment={selectedPayment}
          onClose={() =>
            setSelectedPayment(null)
          }
          onRefund={() =>
            setRefundPaymentData(
              selectedPayment
            )
          }
        />
      )}

      {/* Refund Modal */}
      {refundPaymentData && (
        <RefundModal
          payment={refundPaymentData}
          loading={refundLoading}
          onClose={() =>
            setRefundPaymentData(null)
          }
          onSubmit={handleRefund}
        />
      )}
    </div>
  )
}