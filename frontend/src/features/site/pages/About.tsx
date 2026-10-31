import { pageTitle } from "@/lib/seo"
import { Card } from "@/components/ui/card"
import { Users, MapPin, Award, HeartHandshake } from "lucide-react"
import { PageMeta } from "@/components/common/page-meta"

const metadata = {
  title: pageTitle("About Us"),
  canonical: "/about",
  description: "Learn about Incredible India Tours - your trusted partner for hotels, tour packages, and unforgettable journeys across India.",
}

const stats = [
  { icon: MapPin, value: "50+", label: "Destinations Covered" },
  { icon: Users, value: "25,000+", label: "Happy Travelers" },
  { icon: Award, value: "12+", label: "Years of Experience" },
  { icon: HeartHandshake, value: "500+", label: "Partner Hotels" },
]

export default function AboutPage() {
  return (
    <>
      {/* Replaces the Next.js `export const metadata` block. */}
      <PageMeta {...metadata} />
      <main className="min-h-screen">
        <section className="relative h-[40vh] min-h-[280px] flex items-center justify-center overflow-hidden">
          <img
            loading="eager" fetchPriority="high"
            src="https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=2071&auto=format&fit=crop"
            alt="India landscape"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
          <div className="relative z-10 text-center px-4">
            <p className="text-accent font-medium text-sm uppercase tracking-widest mb-2">Our Story</p>
            <h1 className="font-manrope text-4xl md:text-5xl font-bold text-white">About Incredible India Tours</h1>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-lg leading-relaxed text-foreground/90">
            For over a decade, Incredible India Tours has been helping travelers from around the world discover
            the extraordinary diversity of India - from the snow-capped Himalayas to the sun-soaked beaches of
            Goa, the royal palaces of Rajasthan to the tranquil backwaters of Kerala.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            What started as a small team of passionate local guides has grown into a full-service travel platform,
            offering handpicked hotels, curated tour packages, and seamless booking so you can focus on the
            experience, not the logistics. Every property and package on our platform is personally vetted by
            our team to make sure it meets our standard for quality, safety, and authenticity.
          </p>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map(({ icon: Icon, value, label }) => (
              <Card key={label} className="p-5 text-center">
                <Icon className="size-6 mx-auto mb-2 text-primary" />
                <p className="font-manrope text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </Card>
            ))}
          </div>

          <div className="mt-16">
            <h2 className="font-manrope text-2xl font-bold text-foreground mb-4">Our Promise</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Verified Stays</h3>
                <p className="text-muted-foreground">Every hotel and homestay is inspected against our quality checklist before it's listed.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Local Expertise</h3>
                <p className="text-muted-foreground">Our packages are designed by travel experts who know each region inside and out.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">24/7 Support</h3>
                <p className="text-muted-foreground">From booking to check-out, our support team is here to help whenever you need us.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
