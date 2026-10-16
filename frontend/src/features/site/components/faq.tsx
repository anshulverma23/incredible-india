import { useEffect, useState } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { faqApi } from "@/features/faq/api/faq.api"
import type { FAQ as FAQType } from "@/features/faq/types"
import { ApiError } from "@/lib/axios"

export function FAQ() {
  const [faqs, setFaqs] = useState<FAQType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        setLoading(true)
        setError("")

        const response = await faqApi.list()

        setFaqs(response.faqs || [])
      } catch (err) {
        console.error("FAQ loading error:", err)

        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load FAQs"
        )
      } finally {
        setLoading(false)
      }
    }

    fetchFAQs()
  }, [])

  return (
    <section
      id="faq"
      className="bg-secondary/50 py-20 md:py-32"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
            Common Questions
          </p>

          <h2 className="mb-6 text-balance text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
            Frequently Asked Questions
          </h2>

          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            Planning a trip to India? Here are answers to the most common
            questions from our travelers.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-10 text-center text-muted-foreground">
            Loading FAQs...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-10 text-center text-destructive">
            {error}
          </div>
        )}

        {/* No FAQs */}
        {!loading && !error && faqs.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            No FAQs available at the moment.
          </div>
        )}

        {/* FAQ Accordion */}
        {!loading && !error && faqs.length > 0 && (
          <Accordion className="w-full">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq._id}
                value={faq._id}
              >
                <AccordionTrigger className="text-left font-serif text-lg font-semibold hover:text-primary">
                  {faq.question}
                </AccordionTrigger>

                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

      </div>
    </section>
  )
}

export default FAQ