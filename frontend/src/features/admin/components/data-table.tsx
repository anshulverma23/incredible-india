import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/spinner"

export interface AdminColumn<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
}

export function AdminTable<T extends { _id: string }>({
  columns,
  rows,
  loading,
  onEdit,
  onDelete,
  extraAction,
  emptyLabel = "No records found.",
}: {
  columns: AdminColumn<T>[]
  rows: T[]
  loading: boolean
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  extraAction?: (row: T) => React.ReactNode
  emptyLabel?: string
}) {
  if (loading) return <PageLoader />
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">{col.label}</th>
            ))}
            {(onEdit || onDelete || extraAction) && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-b border-border last:border-0 hover:bg-muted/30">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 align-middle">
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {(onEdit || onDelete || extraAction) && (
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {extraAction?.(row)}
                    {onEdit && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(row)} aria-label="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onDelete(row)} aria-label="Delete" className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
