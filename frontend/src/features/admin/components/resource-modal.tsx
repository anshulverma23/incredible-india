import { useEffect, useState, type FormEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"

export interface AdminField {
  name: string
  label: string
  type: "text" | "textarea" | "number" | "select" | "date" | "checkbox" | "file" | "multifile"
  options?: { label: string; value: string }[]
  required?: boolean
  hint?: string
  colSpan?: 1 | 2
}

export function AdminFormModal({
  open,
  onOpenChange,
  title,
  fields,
  initialValues,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: AdminField[]
  initialValues: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // Resets the form when the dialog opens for a different record. The dialog
  // stays mounted (for its close animation), so this can't be derived during
  // render or replaced by a `key`-based remount without losing that animation.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(initialValues)
      setError("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const setField = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {error && <Alert variant="destructive">{error}</Alert>}

        <form id="admin-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {fields.map((field) => (
            <div key={field.name} className={field.colSpan === 2 ? "sm:col-span-2" : ""}>
              <Label htmlFor={field.name} className="mb-1.5 block">{field.label}</Label>

              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  required={field.required}
                  value={(values[field.name] as string) || ""}
                  onChange={(e) => setField(field.name, e.target.value)}
                />
              ) : field.type === "select" ? (
                <Select
                  id={field.name}
                  required={field.required}
                  value={(values[field.name] as string) || ""}
                  onChange={(e) => setField(field.name, e.target.value)}
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              ) : field.type === "checkbox" ? (
                <input
                  id={field.name}
                  type="checkbox"
                  checked={Boolean(values[field.name])}
                  onChange={(e) => setField(field.name, e.target.checked)}
                  className="size-4 rounded border-input"
                />
              ) : field.type === "file" ? (
                <input
                  id={field.name}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setField(field.name, e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
                />
              ) : field.type === "multifile" ? (
                <input
                  id={field.name}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setField(field.name, e.target.files)}
                  className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
                />
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  required={field.required}
                  value={(values[field.name] as string | number) ?? ""}
                  onChange={(e) => setField(field.name, field.type === "number" ? e.target.valueAsNumber : e.target.value)}
                />
              )}
              {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
            </div>
          ))}
        </form>

        <DialogFooter>
          <Button type="submit" form="admin-form" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
