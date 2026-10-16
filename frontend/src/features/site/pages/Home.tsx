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
