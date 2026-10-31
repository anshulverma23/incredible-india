import { PageMeta } from "@/components/common/page-meta"
import { Hero } from "@/features/site/components/hero"
import { Destinations } from "@/features/site/components/destinations"
import { FeaturedHotels } from "@/features/site/components/featured-hotels"
import { Tours } from "@/features/site/components/tours"
import { Experiences } from "@/features/site/components/experiences"
import { Testimonials } from "@/features/site/components/testimonials"
import { FAQ } from "@/features/site/components/faq"
import { CTA } from "@/features/site/components/cta"

export default function Page() {
  return (
    <main>
      <PageMeta title="Incredible India Travel - Hotels, Tour Packages & Destinations in India" description="Book hand-picked hotels, tour packages and destinations across India. Plan your trip with our free itinerary planner and book online." canonical="/" />
      <Hero />
      <Destinations />
      <FeaturedHotels />
      <Tours />
      <Experiences />
      <Testimonials />
      <FAQ />
      <CTA />
    </main>
  )
}
