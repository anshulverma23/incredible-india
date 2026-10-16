import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FilterSidebar({
  children,
  onClear,
}: {
  children: React.ReactNode
  onClear: () => void
}) {
  return (
    <aside className="w-full shrink-0 md:w-64">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
            <SlidersHorizontal className="size-4" /> Filters
          </h3>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-auto p-1 text-xs text-muted-foreground">
            <X className="size-3" /> Clear
          </Button>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </aside>
  )
}

export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  )
}
