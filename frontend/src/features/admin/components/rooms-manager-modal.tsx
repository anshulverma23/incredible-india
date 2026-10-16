import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"
import { formatINR } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { hotelApi } from "@/features/hotels/api/hotel.api"
import { ApiError } from "@/lib/axios"
import type { Hotel, Room } from "@/features/hotels/types"

const ROOM_TYPES = ["Single", "Double", "Twin", "Deluxe", "Suite", "Family"]

export function RoomsManagerModal({ hotel, open, onOpenChange }: { hotel: Hotel | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ roomType: "Double", price: 0, capacity: 2, totalRooms: 1 })
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!hotel) return
    setLoading(true)
    hotelApi.get(hotel._id).then((res) => setRooms(res.rooms)).finally(() => setLoading(false))
  }

  // Resets the rooms list when the dialog opens for a different hotel. The
  // dialog stays mounted (for its close animation), so this can't be derived
  // during render or replaced by a `key`-based remount without losing that animation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hotel])

  if (!hotel) return null

  const addRoom = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => formData.append(k, String(v)))
      await hotelApi.addRoom(hotel._id, formData)
      toast("Room added")
      setForm({ roomType: "Double", price: 0, capacity: 2, totalRooms: 1 })
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not add room", "error")
    } finally {
      setSaving(false)
    }
  }

  const deleteRoom = async (roomId: string) => {
    if (!confirm("Delete this room type?")) return
    try {
      await hotelApi.deleteRoom(hotel._id, roomId)
      toast("Room deleted")
      load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete room", "error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rooms - {hotel.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading rooms...</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms added yet.</p>
          ) : (
            rooms.map((room) => (
              <div key={room._id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{room.roomType}</p>
                  <p className="text-xs text-muted-foreground">{formatINR(room.price)}/night · {room.capacity} guests · {room.totalRooms} rooms</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteRoom(room._id)} className="text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">Add a room type</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={form.roomType} onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))}>
              {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input type="number" placeholder="Price/night" value={form.price || ""} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
            <Input type="number" placeholder="Capacity" value={form.capacity || ""} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
            <Input type="number" placeholder="Total rooms" value={form.totalRooms || ""} onChange={(e) => setForm((f) => ({ ...f, totalRooms: Number(e.target.value) }))} />
          </div>
          <Button size="sm" onClick={addRoom} disabled={saving} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="size-3.5 mr-1" /> {saving ? "Adding..." : "Add Room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
