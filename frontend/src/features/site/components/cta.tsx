import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=2074&auto=format&fit=crop')",
        }}
      >
        <div className="absolute inset-0 bg-foreground/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold text-background mb-6 text-balance">
          Ready to Discover the Magic of India?
        </h2>
        <p className="text-background/80 text-lg md:text-xl mb-8 text-pretty max-w-2xl mx-auto">
          Let us craft your perfect Indian adventure. Whether you dream of
          ancient temples, pristine beaches, or mountain peaks — your journey
          begins with a single step.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8"
          >
            Start Planning
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-background/30 text-black text-base px-8"
          >
            Contact Us
          </Button>
        </div>
      </div>
    </section>
  )
}
