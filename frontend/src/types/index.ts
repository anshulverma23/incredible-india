export interface CloudImage {
  url: string
  public_id: string
}

export interface PaginatedResponse<T> {
  success: boolean
  count: number
  total: number
  page: number
  pages: number
  [key: string]: unknown | T[]
}
