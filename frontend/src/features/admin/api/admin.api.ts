import { api } from "@/lib/axios";
import type { Booking } from "@/features/bookings/types";

export interface MonthlyRevenue {
  year: number;
  month: number;
  label: string;
  revenue: number;
  refunds: number;
  net: number;
  payments: number;
}

export interface DashboardData {
  stats: Record<string, number>;
  bookingsByStatus: { _id: string; count: number }[];
  bookingsByType: { _id: string; count: number }[];
  monthlyRevenue: MonthlyRevenue[];
  popularDestinations: { _id: string; name?: string; state?: string; bookings: number; revenue: number }[];
  popularPackages: { _id: string; name?: string; bookings: number; travellers: number; revenue: number }[];
  recentBookings: Booking[];
}

export const adminApi = {
  /** One call powers the whole dashboard (stats + charts). */
  dashboard: () => api.get<DashboardData>("/admin/dashboard"),
  revenueReport: (months = 12) => api.get<{ months: MonthlyRevenue[] }>("/admin/reports/revenue", { months }),
  bookingReport: () =>
    api.get<{ byStatus: { _id: string; count: number }[]; byType: { _id: string; count: number }[] }>("/admin/reports/bookings"),
  paymentReport: () =>
    api.get<{ byStatus: { _id: string; count: number; amount: number }[]; byGateway: { _id: string; count: number; amount: number }[] }>("/admin/reports/payments"),
};
