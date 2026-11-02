import { useState } from "react"
import { crumbs, faqJsonLd, pageTitle } from "@/lib/seo"
import { FAQ } from "@/features/site/components/faq"
import { PageMeta } from "@/components/common/page-meta"
import type { FAQ as FAQType } from "@/features/faq/types"

const metadata = {
  title: pageTitle("Frequently Asked Questions"),
  canonical: "/faq",
  description: "Answers to common questions about traveling in India, visas, best time to visit, and booking with us.",
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQType[]>([])

  return (
    <>
      {/* FAQPage structured data is built from the questions loaded below (Google can show them as rich results). */}
      <PageMeta {...metadata} jsonLd={[crumbs({ name: "FAQ", path: metadata.canonical }), ...(faqs.length > 0 ? [faqJsonLd(faqs)] : [])]} />
      <main className="min-h-screen pt-16">
        <FAQ onLoaded={setFaqs} />
      </main>
    </>
  )
}
