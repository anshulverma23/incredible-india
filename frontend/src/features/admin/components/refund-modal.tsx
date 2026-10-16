import { useState } from "react";

import type { Payment } from "../types/payment";

interface RefundModalProps {
  payment: Payment;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (
    amount: number | undefined,
    reason: string
  ) => void;
}

export default function RefundModal({
  payment,
  loading = false,
  onClose,
  onSubmit,
}: RefundModalProps) {
  const remainingAmount =
    payment.amount - (payment.refundAmount || 0);

  const [amount, setAmount] = useState(
    remainingAmount.toString()
  );

  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > remainingAmount
    ) {
      return;
    }

    onSubmit(numericAmount, reason);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">
            Refund Payment
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Refund amount up to ₹
            {remainingAmount.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Refund Amount
            </label>

            <input
              type="number"
              min="1"
              max={remainingAmount}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Reason
            </label>

            <textarea
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              rows={3}
              placeholder="Enter refund reason..."
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t p-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : "Confirm Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}