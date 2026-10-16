export interface Coupon {
  _id: string
  code: string
  discountType: "percentage" | "flat"
  discountValue: number
  minPurchaseAmount: number
  maxDiscountAmount?: number
  applicableOn: "all" | "hotel" | "package"
  expiryDate: string
  usageLimit: number
  perUserLimit?: number
  description?: string
  usedCount: number
  isActive: boolean
}
