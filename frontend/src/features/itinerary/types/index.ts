export interface ItineraryActivity {
  name: string
  description?: string
  categories: string[]
  durationHours: number
  estimatedCost: number
  timeOfDay: "morning" | "afternoon" | "evening" | "any"
}

export interface ItineraryDay {
  day: number
  area: string
  title: string
  stay: string | null
  activities: ItineraryActivity[]
  estimatedCost: number
}

export interface ItineraryInput {
  destination: string
  days: number
  budget: number
  travellers: number
  interests: string[]
  pace: "relaxed" | "balanced" | "packed"
}

export interface ItineraryPlan {
  destination: { _id: string; name: string; city?: string; state?: string; bestTimeToVisit?: string }
  summary: {
    days: number
    nights: number
    travellers: number
    pace: string
    interests: string[]
    tier: "budget" | "standard" | "luxury"
    budget: number
    estimatedTotal: number
    perPerson: number
    withinBudget: boolean
    remaining: number
    shortfall: number
  }
  breakdown: { stay: number; food: number; localTransport: number; activities: number }
  route: string[]
  days: ItineraryDay[]
  droppedForBudget: string[]
  notes: string[]
  suggestions: {
    packages: { _id: string; slug?: string; name: string; price: number; duration: { days: number; nights: number }; packageType: string; rating: number }[]
    hotels: { _id: string; name: string; rating: number; hotelType: string; fromPrice?: number; overBudgetBy?: number; location: { city: string } }[]
  }
}

export interface SavedItinerary {
  _id: string
  title: string
  input: ItineraryInput
  plan: ItineraryPlan
  createdAt: string
}

export interface PlannableDestination {
  _id: string
  name: string
  city: string
  state: string
}
