import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getPaymentStats,
  getPayments,
} from "../api/payments.api";

import type {
  Payment,
  PaymentFilters,
  PaymentStats,
} from "../types/payment";

const initialStats: PaymentStats = {
  totalPayments: 0,
  totalAmount: 0,
  successfulPayments: 0,
  successfulRevenue: 0,
  pendingPayments: 0,
  pendingAmount: 0,
  failedPayments: 0,
  failedAmount: 0,
  refundedPayments: 0,
  refundedAmount: 0,
};

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] =
    useState<PaymentStats>(initialStats);

  const [filters, setFilters] =
    useState<PaymentFilters>({
      page: 1,
      limit: 10,
      status: "all",
      gateway: "all",
      search: "",
    });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] =
    useState(true);

  const [error, setError] = useState<string | null>(
    null
  );

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getPayments(filters);

      setPayments(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const response = await getPaymentStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      setStats(response.data);
    } catch (err) {
      console.error("Payment stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [
    filters.startDate,
    filters.endDate,
  ]);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchPayments(),
      fetchStats(),
    ]);
  }, [fetchPayments, fetchStats]);

  // Fetch-on-mount / on filter change: the loaders set loading state before awaiting the request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, [fetchStats]);

  const updateFilters = (
    updates: Partial<PaymentFilters>
  ) => {
    setFilters((current) => ({
      ...current,
      ...updates,
      ...(updates.page === undefined
        ? { page: 1 }
        : {}),
    }));
  };

  return {
    payments,
    stats,
    filters,
    pagination,
    loading,
    statsLoading,
    error,

    updateFilters,
    refresh,
    fetchPayments,
  };
}