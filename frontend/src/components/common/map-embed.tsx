import { MapPin } from "lucide-react"
import { env } from "@/config/env"

export function MapEmbed({ lat, lng, label }: { lat?: number; lng?: number; label: string }) {
  const apiKey = env.GOOGLE_MAPS_API_KEY

  if (!lat || !lng) return null

  if (apiKey) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <iframe
          title={`Map showing ${label}`}
          width="100%"
          height="280"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}`}
        />
      </div>
    )
  }

  // No API key configured - fall back to a simple link so the feature still works
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-primary hover:bg-muted"
    >
      <MapPin className="size-4" /> View {label} on Google Maps
    </a>
  )
}
