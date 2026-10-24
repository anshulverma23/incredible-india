import { useEffect, useState } from "react"
import { AdminTable, type AdminColumn } from "@/features/admin/components/data-table"
import { AdminFormModal, type AdminField } from "@/features/admin/components/resource-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatINR } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { packageApi } from "@/features/packages/api/package.api"
import { destinationApi } from "@/features/destinations/api/destination.api"
import { ApiError } from "@/lib/axios"
import type { TourPackage } from "@/features/packages/types"
import type { Destination } from "@/features/destinations/types"

const PACKAGE_TYPES = ["Adventure", "Luxury", "Family", "Honeymoon", "Pilgrimage", "Wildlife", "Cultural"].map((t) => ({ label: t, value: t }))

export default function AdminPackagesPage() {
  const { toast } = useToast()
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TourPackage | null>(null)

  const fetchPackages = () =>
    Promise.all([
      packageApi.list({ limit: 50 }),
      destinationApi.list({ limit: 100 }),
    ])
      .then(([pkgRes, destRes]) => {
        setPackages((pkgRes.packages as TourPackage[]) || [])
        setDestinations((destRes.destinations as Destination[]) || [])
      })
      .finally(() => setLoading(false))

  const load = () => {
    setLoading(true)
    fetchPackages()
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const fields: AdminField[] = [
    { name: "name", label: "Package Name", type: "text", required: true },
    { name: "slug", label: "URL Slug (SEO)", type: "text", hint: "Optional. Leave blank to auto-generate from the name, e.g. kashmir-paradise-tour" },
    { name: "destination", label: "Destination", type: "select", required: true, options: destinations.map((d) => ({ label: d.name, value: d._id })) },
    { name: "packageType", label: "Package Type", type: "select", required: true, options: PACKAGE_TYPES },
    { name: "days", label: "Duration (days)", type: "number", required: true },
    { name: "nights", label: "Duration (nights)", type: "number", required: true },
    { name: "price", label: "Price per person (₹)", type: "number", required: true },
    { name: "maxGroupSize", label: "Max Group Size", type: "number" },
    { name: "description", label: "Description", type: "textarea", required: true, colSpan: 2 },
    { name: "itinerary", label: "Itinerary", type: "textarea", colSpan: 2, hint: "One day per line: Title | Description" },
    { name: "included", label: "Included", type: "text", hint: "Comma separated" },
    { name: "excluded", label: "Excluded", type: "text", hint: "Comma separated" },
    { name: "gallery", label: "Gallery Images", type: "multifile", colSpan: 2 },
  ]

  const handleSubmit = async (values: Record<string, unknown>) => {
    const formData = new FormData()
    formData.append("name", String(values.name || ""))
    // blank = backend generates it from the name (create) or keeps the current one (edit)
    const slug = String(values.slug || "").trim()
    if (slug) formData.append("slug", slug)
    formData.append("destination", String(values.destination || ""))
    formData.append("packageType", String(values.packageType || "Cultural"))
    formData.append("description", String(values.description || ""))
    formData.append("price", String(values.price || 0))
    formData.append("maxGroupSize", String(values.maxGroupSize || 15))
    formData.append("duration", JSON.stringify({ days: Number(values.days) || 1, nights: Number(values.nights) || 0 }))
    formData.append("included", JSON.stringify(String(values.included || "").split(",").map((s) => s.trim()).filter(Boolean)))
    formData.append("excluded", JSON.stringify(String(values.excluded || "").split(",").map((s) => s.trim()).filter(Boolean)))

    const itineraryLines = String(values.itinerary || "").split("\n").map((l) => l.trim()).filter(Boolean)
    const itinerary = itineraryLines.map((line, i) => {
      const [title, description] = line.split("|").map((s) => s.trim())
      return { day: i + 1, title: title || `Day ${i + 1}`, description: description || "" }
    })
    formData.append("itinerary", JSON.stringify(itinerary))

    const files = values.gallery as FileList | null
    if (files) Array.from(files).forEach((f) => formData.append("gallery", f))

    if (editing) {
      await packageApi.update(editing._id, formData)
      toast("Package updated")
    } else {
      await packageApi.create(formData)
      toast("Package created")
    }
    load()
  }

  const handleDelete = async (pkg: TourPackage) => {
    if (!confirm(`Delete "${pkg.name}"?`)) return
    try {
      await packageApi.remove(pkg._id)
      toast("Package deleted")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete package", "error")
    }
  }

  const columns: AdminColumn<TourPackage>[] = [
    { key: "name", label: "Name" },
    { key: "slug", label: "URL", render: (p) => <span className="text-xs text-muted-foreground">/packages/{p.slug || "-"}</span> },
    { key: "packageType", label: "Type", render: (p) => <Badge variant="outline">{p.packageType}</Badge> },
    { key: "duration", label: "Duration", render: (p) => `${p.duration.days}D / ${p.duration.nights}N` },
    { key: "price", label: "Price", render: (p) => formatINR(p.price) },
  ]

  const initialValues = editing
    ? {
        name: editing.name,
        slug: editing.slug || "",
        destination: typeof editing.destination === "object" ? editing.destination._id : editing.destination,
        packageType: editing.packageType,
        days: editing.duration.days,
        nights: editing.duration.nights,
        price: editing.price,
        maxGroupSize: editing.maxGroupSize,
        description: editing.description,
        itinerary: editing.itinerary.map((d) => `${d.title}${d.description ? " | " + d.description : ""}`).join("\n"),
        included: editing.included.join(", "),
        excluded: editing.excluded.join(", "),
      }
    : { packageType: "Cultural", maxGroupSize: 15 }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Manage Packages</h1>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }} className="bg-primary text-primary-foreground hover:bg-primary/90">+ Add Package</Button>
      </div>

      <AdminTable
        columns={columns}
        rows={packages}
        loading={loading}
        onEdit={(p) => { setEditing(p); setModalOpen(true) }}
        onDelete={handleDelete}
      />

      <AdminFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Package" : "Add Package"}
        fields={fields}
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
