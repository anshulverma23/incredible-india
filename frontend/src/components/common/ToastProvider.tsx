import { useCallback, useState, type ReactNode } from "react"
import { CheckCircle2, XCircle, X } from "lucide-react"
import { ToastContext } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

interface Toast {
  id: number
  message: string
  variant: "success" | "error"
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2",
              t.variant === "success"
                ? "border-primary/20 bg-card text-card-foreground"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X className="size-3.5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
