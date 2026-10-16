import { api } from "@/lib/axios"

export interface ContactFormData {
  name: string
  email: string
  subject?: string
  message: string
}

export interface ContactResponse {
  success: boolean
  message: string
}

export const contactApi = {
  send: (body: ContactFormData) =>
    api.post<ContactResponse>("/contact", body),
}