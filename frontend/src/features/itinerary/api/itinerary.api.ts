import { api } from "@/lib/axios"
import type { ItineraryInput, ItineraryPlan, PlannableDestination, SavedItinerary } from "@/features/itinerary/types"

export const itineraryApi = {
  destinations: () => api.get<{ destinations: PlannableDestination[] }>("/itinerary/destinations"),
  generate: (input: ItineraryInput) => api.post<{ itinerary: ItineraryPlan }>("/itinerary/generate", input),
  save: (input: ItineraryInput, plan: ItineraryPlan, title?: string) => api.post<{ itinerary: SavedItinerary }>("/itinerary", { input, plan, title }),
  mine: () => api.get<{ itineraries: SavedItinerary[] }>("/itinerary/my"),
  remove: (id: string) => api.delete(`/itinerary/${id}`),
}
