import { api } from "@/lib/axios"
import type { Coupon } from "@/features/payments/types"

export const couponApi = {
  validate: (code: string, amount: number, bookingType: string) =>
    api.post<{ discount: number; coupon: string; payable: number }>("/coupons/validate", { code, amount, bookingType }),
  adminList: () => api.get<{ coupons: Coupon[] }>("/coupons", { limit: 100 }),
  create: (body: Record<string, unknown>) => api.post<{ coupon: Coupon }>("/coupons", body),
  update: (id: string, body: Record<string, unknown>) => api.put<{ coupon: Coupon }>(`/coupons/${id}`, body),
  remove: (id: string) => api.delete(`/coupons/${id}`),
}
