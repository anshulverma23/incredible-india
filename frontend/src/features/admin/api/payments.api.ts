import { api } from "@/lib/axios";

import type {
  Payment,
  PaymentFilters,
  PaymentStats,
  PaymentsResponse,
  RefundPayload,
  RevenuePoint,
} from "../types/payment";

// Uses the shared axios client (api base URL, auth header, silent token refresh).

export const getPayments = (filters: PaymentFilters = {}) =>
  api.get<PaymentsResponse>("/payment/admin", filters as Record<string, unknown>);

export const getPaymentById = (paymentId: string) =>
  api.get<{ success: boolean; data: Payment }>(`/payment/admin/${paymentId}`);

export const getPaymentStats = (params?: { startDate?: string; endDate?: string }) =>
  api.get<{ success: boolean; data: PaymentStats }>("/payment/admin/stats", params);

export const getRevenueReport = (params?: { startDate?: string; endDate?: string; groupBy?: "day" | "month" | "year" }) =>
  api.get<{ success: boolean; data: RevenuePoint[] }>("/payment/admin/revenue", params);

export const refundPayment = (paymentId: string, payload: RefundPayload) =>
  api.post<{ success: boolean; message: string; data: Payment }>(`/payment/admin/${paymentId}/refund`, payload);
