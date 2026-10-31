import { pageTitle } from "@/lib/seo"
import { FAQ } from "@/features/site/components/faq"
import { PageMeta } from "@/components/common/page-meta"

const metadata = {
  title: pageTitle("Frequently Asked Questions"),
  canonical: "/faq",
  description: "Answers to common questions about traveling in India, visas, best time to visit, and booking with us.",
}

export default function FAQPage() {
  return (
    <>
      {/* Replaces the Next.js `export const metadata` block. */}
      <PageMeta {...metadata} />
      <main className="min-h-screen pt-16">
        <FAQ />
      </main>
    </>
  )
}
