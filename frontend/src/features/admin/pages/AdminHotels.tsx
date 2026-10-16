import { useEffect, useState } from "react"
import { BedDouble } from "lucide-react"
import { AdminTable, type AdminColumn } from "@/features/admin/components/data-table"
import { AdminFormModal, type AdminField } from "@/features/admin/components/resource-modal"
import { RoomsManagerModal } from "@/features/admin/components/rooms-manager-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { hotelApi } from "@/features/hotels/api/hotel.api"
import { ApiError } from "@/lib/axios"
import type { Hotel } from "@/features/hotels/types"

const HOTEL_TYPES = ["Budget", "Standard", "Luxury", "Resort", "Boutique", "Heritage"].map((t) => ({ label: t, value: t }))

const fields: AdminField[] = [
  { name: "name", label: "Hotel Name", type: "text", required: true },
  { name: "hotelType", label: "Hotel Type", type: "select", options: HOTEL_TYPES, required: true },
  { name: "description", label: "Description", type: "textarea", required: true, colSpan: 2 },
  { name: "address", label: "Address", type: "text", required: true },
  { name: "city", label: "City", type: "text", required: true },
  { name: "state", label: "State", type: "text" },
  { name: "country", label: "Country", type: "text" },
  { name: "lat", label: "Latitude (optional)", type: "number" },
  { name: "lng", label: "Longitude (optional)", type: "number" },
  { name: "amenities", label: "Amenities", type: "text", hint: "Comma separated, e.g. WiFi, Pool, Spa", colSpan: 2 },
  { name: "images", label: "Images", type: "multifile", hint: "Add one or more photos", colSpan: 2 },
]

export default function AdminHotelsPage() {
  const { toast } = useToast()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Hotel | null>(null)
  const [roomsHotel, setRoomsHotel] = useState<Hotel | null>(null)
  const [roomsOpen, setRoomsOpen] = useState(false)

  const fetchHotels = () =>
    hotelApi.list({ limit: 50 }).then((res) => setHotels((res.hotels as Hotel[]) || [])).finally(() => setLoading(false))

  const load = () => {
    setLoading(true)
    fetchHotels()
  }

  useEffect(() => {
    fetchHotels()
  }, [])

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (hotel: Hotel) => { setEditing(hotel); setModalOpen(true) }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const formData = new FormData()
    formData.append("name", String(values.name || ""))
    formData.append("hotelType", String(values.hotelType || "Standard"))
    formData.append("description", String(values.description || ""))
    formData.append(
      "location",
      JSON.stringify({
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country || "India",
        coordinates: values.lat && values.lng ? { lat: Number(values.lat), lng: Number(values.lng) } : undefined,
      })
    )
    formData.append(
      "amenities",
      JSON.stringify(String(values.amenities || "").split(",").map((s) => s.trim()).filter(Boolean))
    )
    const files = values.images as FileList | null
    if (files) Array.from(files).forEach((f) => formData.append("images", f))

    if (editing) {
      await hotelApi.update(editing._id, formData)
      toast("Hotel updated")
    } else {
      await hotelApi.create(formData)
      toast("Hotel created")
    }
    load()
  }

  const handleDelete = async (hotel: Hotel) => {
    if (!confirm(`Delete "${hotel.name}"? This also removes its rooms.`)) return
    try {
      await hotelApi.remove(hotel._id)
      toast("Hotel deleted")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete hotel", "error")
    }
  }

  const columns: AdminColumn<Hotel>[] = [
    { key: "name", label: "Name" },
    { key: "city", label: "City", render: (h) => `${h.location.city}, ${h.location.state || ""}` },
    { key: "hotelType", label: "Type", render: (h) => <Badge variant="outline">{h.hotelType}</Badge> },
    { key: "rating", label: "Rating", render: (h) => `${h.rating.toFixed(1)} (${h.numReviews})` },
  ]

  const initialValues = editing
    ? {
        name: editing.name,
        hotelType: editing.hotelType,
        description: editing.description,
        address: editing.location.address,
        city: editing.location.city,
        state: editing.location.state,
        country: editing.location.country,
        lat: editing.location.coordinates?.lat,
        lng: editing.location.coordinates?.lng,
        amenities: editing.amenities.join(", "),
      }
    : { country: "India", hotelType: "Standard" }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Manage Hotels</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">+ Add Hotel</Button>
      </div>

      <AdminTable
        columns={columns}
        rows={hotels}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
        extraAction={(h) => (
          <Button variant="ghost" size="icon-sm" onClick={() => { setRoomsHotel(h); setRoomsOpen(true) }} title="Manage rooms">
            <BedDouble className="size-3.5" />
          </Button>
        )}
      />

      <AdminFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Hotel" : "Add Hotel"}
        fields={fields}
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />

      <RoomsManagerModal hotel={roomsHotel} open={roomsOpen} onOpenChange={setRoomsOpen} />
    </div>
  )
}
