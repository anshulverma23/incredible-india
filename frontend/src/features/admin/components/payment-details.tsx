import type { Payment } from "../types/payment";

interface PaymentDetailsProps {
  payment: Payment;
  onClose: () => void;
  onRefund: () => void;
}

const formatCurrency = (
  amount: number,
  currency = "INR"
) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const getName = (payment: Payment) => {
  if (
    typeof payment.user === "object" &&
    payment.user
  ) {
    return payment.user.name || "Unknown User";
  }

  return "Unknown User";
};

const getEmail = (payment: Payment) => {
  if (
    typeof payment.user === "object" &&
    payment.user
  ) {
    return payment.user.email || "-";
  }

  return "-";
};

const getBookingReference = (
  payment: Payment
) => {
  if (
    typeof payment.booking === "object" &&
    payment.booking
  ) {
    return (
      payment.booking.bookingReference ||
      payment.booking._id
    );
  }

  return payment.booking;
};

export default function PaymentDetails({
  payment,
  onClose,
  onRefund,
}: PaymentDetailsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-semibold">
              Payment Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {payment._id}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">
              Customer
            </p>

            <p className="mt-1 font-medium">
              {getName(payment)}
            </p>

            <p className="text-sm text-gray-500">
              {getEmail(payment)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Booking
            </p>

            <p className="mt-1 font-medium">
              {getBookingReference(payment)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Amount
            </p>

            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(
                payment.amount,
                payment.currency
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Gateway
            </p>

            <p className="mt-1 capitalize font-medium">
              {payment.gateway}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Status
            </p>

            <span className="mt-1 inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm capitalize">
              {payment.status.replaceAll("_", " ")}
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-500">
              Created
            </p>

            <p className="mt-1 text-sm">
              {new Date(
                payment.createdAt
              ).toLocaleString("en-IN")}
            </p>
          </div>

          {payment.razorpayOrderId && (
            <div>
              <p className="text-xs text-gray-500">
                Razorpay Order ID
              </p>

              <p className="mt-1 break-all text-sm">
                {payment.razorpayOrderId}
              </p>
            </div>
          )}

          {payment.razorpayPaymentId && (
            <div>
              <p className="text-xs text-gray-500">
                Razorpay Payment ID
              </p>

              <p className="mt-1 break-all text-sm">
                {payment.razorpayPaymentId}
              </p>
            </div>
          )}

          {(payment.refundAmount || 0) > 0 && (
            <div>
              <p className="text-xs text-gray-500">
                Refunded Amount
              </p>

              <p className="mt-1 font-medium">
                {formatCurrency(
                  payment.refundAmount || 0,
                  payment.currency
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t p-5">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Close
          </button>

          {payment.status === "paid" ||
          payment.status === "partially_refunded" ? (
            <button
              onClick={onRefund}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Refund Payment
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}