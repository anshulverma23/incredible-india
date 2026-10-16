import { createContext, useContext } from "react"

export interface ToastContextValue {
  toast: (message: string, variant?: "success" | "error") => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}
