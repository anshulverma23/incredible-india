// ================================
// FAQ Interface
// ================================

export interface FAQ {
  _id: string
  question: string
  answer: string
  category: string
  isActive: boolean
  order: number
  createdAt?: string
  updatedAt?: string
}

// ================================
// FAQ List Response
// ================================

export interface FAQListResponse {
  success: boolean
  count: number
  faqs: FAQ[]
}

// ================================
// Single FAQ Response
// ================================

export interface FAQResponse {
  success: boolean
  faq: FAQ
}

// ================================
// FAQ Form Data
// ================================

export interface FAQFormData {
  question: string
  answer: string
  category?: string
  isActive?: boolean
  order?: number
}