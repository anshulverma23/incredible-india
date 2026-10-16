import { Star } from "lucide-react"

const testimonials = [
  {
    name: "Sarah Mitchell",
    location: "New York, USA",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    quote:
      "The Golden Triangle tour exceeded all expectations. Our guide's knowledge and the seamless organization made this trip unforgettable. Standing before the Taj Mahal at sunrise was a dream come true.",
    rating: 5,
    tour: "Golden Triangle Classic",
  },
  {
    name: "James Thompson",
    location: "London, UK",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    quote:
      "Kerala's backwaters were like stepping into another world. The houseboat experience, the food, the warmth of the people – everything was perfect. I've already booked my return trip!",
    rating: 5,
    tour: "Kerala Backwater Bliss",
  },
  {
    name: "Elena Rodriguez",
    location: "Barcelona, Spain",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
    quote:
      "The Himalayan adventure pushed me out of my comfort zone in the best way. From ancient monasteries to breathtaking views, every day brought new wonders. Truly life-changing.",
    rating: 5,
    tour: "Himalayan Adventure",
  },
]

export function Testimonials() {
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-accent font-medium text-sm uppercase tracking-widest mb-4">
            Traveler Stories
          </p>
          <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
            What Our Travelers Say
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            Real experiences from real travelers. Discover why thousands choose
            Incredible India Tours for their journey of a lifetime.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-accent text-accent"
                  />
                ))}
              </div>
              <blockquote className="text-foreground mb-6 text-pretty leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                  <img
                    loading="lazy" decoding="async"
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.location}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-primary font-medium">
                {testimonial.tour}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
