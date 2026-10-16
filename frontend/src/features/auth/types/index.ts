import type { CloudImage } from "@/types"

/** The platform has exactly two roles. */
export type Role = "user" | "admin"

/** Only an admin may use the admin panel. */
export const isAdminRole = (role?: Role) => role === "admin"

export interface User {
  _id: string
  name: string
  email: string
  phone?: string
  avatar?: CloudImage
  role: Role
  isEmailVerified: boolean
  isActive?: boolean
  createdAt?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  phone?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
