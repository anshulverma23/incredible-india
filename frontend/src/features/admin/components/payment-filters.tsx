import type {
  PaymentFilters as PaymentFiltersType,
  PaymentGateway,
  PaymentStatus,
} from "../types/payment";

interface PaymentFiltersProps {
  filters: PaymentFiltersType;
  onChange: (
    filters: Partial<PaymentFiltersType>
  ) => void;
}

export default function PaymentFilters({
  filters,
  onChange,
}: PaymentFiltersProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          value={filters.search || ""}
          onChange={(e) =>
            onChange({
              search: e.target.value,
            })
          }
          placeholder="Search payments..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
        />

        <select
          value={filters.status || "all"}
          onChange={(e) =>
            onChange({
              status:
                e.target.value as
                  | PaymentStatus
                  | "all",
            })
          }
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="created">Created</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="partially_refunded">
            Partially Refunded
          </option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          value={filters.gateway || "all"}
          onChange={(e) =>
            onChange({
              gateway:
                e.target.value as
                  | PaymentGateway
                  | "all",
            })
          }
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All Gateways</option>
          <option value="razorpay">Razorpay</option>
        </select>

        <input
          type="date"
          value={filters.startDate || ""}
          onChange={(e) =>
            onChange({
              startDate: e.target.value,
            })
          }
          className="rounded-lg border px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={filters.endDate || ""}
          onChange={(e) =>
            onChange({
              endDate: e.target.value,
            })
          }
          className="rounded-lg border px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}