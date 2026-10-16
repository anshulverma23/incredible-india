export type PaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentGateway = "razorpay";

export interface PaymentUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface PaymentBooking {
  _id: string;
  bookingReference?: string;
  bookingStatus?: string;
  pricing?: { totalAmount?: number };
  paymentStatus?: string;
  checkIn?: string;
  checkOut?: string;
  package?: unknown;
  hotel?: unknown;
  guests?: { adults: number; children: number };
}

export interface Payment {
  _id: string;

  booking:
    | string
    | PaymentBooking;

  user:
    | string
    | PaymentUser;

  gateway: PaymentGateway;

  amount: number;
  currency: string;

  status: PaymentStatus;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;

  refundAmount?: number;
  refundId?: string;
  refundReason?: string;
  refundedAt?: string;

  failureReason?: string;

  paidAt?: string;
  failedAt?: string;

  metadata?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface PaymentPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaymentsResponse {
  success: boolean;
  data: Payment[];
  pagination: PaymentPagination;
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;

  successfulPayments: number;
  successfulRevenue: number;

  pendingPayments: number;
  pendingAmount: number;

  failedPayments: number;
  failedAmount: number;

  refundedPayments: number;
  refundedAmount: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  payments: number;
  refunds: number;
  netRevenue: number;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: PaymentStatus | "all";
  gateway?: PaymentGateway | "all";
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export interface RefundPayload {
  amount?: number;
  reason?: string;
}