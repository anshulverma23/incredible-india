import type { PaymentStats as PaymentStatsType } from "../types/payment";

interface PaymentStatsProps {
  stats: PaymentStatsType;
  loading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function PaymentStats({
  stats,
  loading = false,
}: PaymentStatsProps) {
  const cards = [
    {
      title: "Total Payments",
      value: stats.totalPayments,
      subtitle: formatCurrency(stats.totalAmount),
    },
    {
      title: "Successful",
      value: stats.successfulPayments,
      subtitle: formatCurrency(
        stats.successfulRevenue
      ),
    },
    {
      title: "Pending",
      value: stats.pendingPayments,
      subtitle: formatCurrency(
        stats.pendingAmount
      ),
    },
    {
      title: "Failed",
      value: stats.failedPayments,
      subtitle: formatCurrency(
        stats.failedAmount
      ),
    },
    {
      title: "Refunded",
      value: stats.refundedPayments,
      subtitle: formatCurrency(
        stats.refundedAmount
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-8 w-16 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-200" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                {card.title}
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-gray-900">
                {card.value}
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                {card.subtitle}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}