import { env } from "@/config/env"

/** One place for the brand name + SEO defaults. Change SITE_NAME here and every page title follows. */
export const SITE_NAME = "Incredible India Travel"
export const DEFAULT_DESCRIPTION = "Plan your India trip: hand-picked destinations, hotels and travel packages, with online booking."
/** 1200x630 share image (WhatsApp / Facebook / X previews). */
export const DEFAULT_IMAGE = "/images/og-default.jpg"

/** Website origin: VITE_SITE_URL in production, the current origin otherwise (local dev, previews). */
export const siteUrl = () => (env.SITE_URL || window.location.origin).replace(/\/+$/, "")

/** "/hotels/x" -> "https://site.com/hotels/x". Already-absolute URLs (Cloudinary images) are kept. */
export const absoluteUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`

/** "Hotels" -> "Hotels | Incredible India Travel" */
export const pageTitle = (title: string) => `${title} | ${SITE_NAME}`

/** Meta descriptions: single line, max ~155 chars, cut on a word boundary. */
export const truncate = (text: string, max = 155) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : cut.length).replace(/[,.;:\s-]+$/, "")}…`
}

/* ------------------------------------------------------------------ */
/* schema.org (JSON-LD) builders - pass the result to <PageMeta jsonLd> */
/* ------------------------------------------------------------------ */
type JsonLd = Record<string, unknown>
type Crumb = { name: string; path: string }

/** Public contact details of the business (also shown on the Contact page + footer). */
export const SITE_CONTACT = {
  email: "support@indiatravel.com",
  phone: "+91 98765 43210",
  address: { "@type": "PostalAddress", streetAddress: "Connaught Place", addressLocality: "New Delhi", addressCountry: "IN" },
}

/** Breadcrumb trail, always starting at Home: crumbs({ name: "Hotels", path: "/hotels" }, { name: hotel.name, path: hotelPath(hotel) }) */
export const crumbs = (...trail: Crumb[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [{ name: "Home", path: "/" }, ...trail].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
})

/** The items shown on a list page (hotels, packages, destinations, posts). */
export const itemListJsonLd = (name: string, items: Crumb[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  numberOfItems: items.length,
  itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: absoluteUrl(c.path) })),
})

const plainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

export const faqJsonLd = (faqs: { question: string; answer: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: plainText(f.answer) } })),
})

/** The business itself (home page): a travel agency serving India. */
export const travelAgencyJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: SITE_NAME,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/favicon.svg"),
  image: absoluteUrl(DEFAULT_IMAGE),
  description: DEFAULT_DESCRIPTION,
  email: SITE_CONTACT.email,
  telephone: SITE_CONTACT.phone,
  address: SITE_CONTACT.address,
  areaServed: { "@type": "Country", name: "India" },
})

/** A page of a given schema.org type (AboutPage, ContactPage...) about this business. */
export const webPageJsonLd = (type: "AboutPage" | "ContactPage" | "CollectionPage", name: string, path: string, description: string): JsonLd => ({
  "@context": "https://schema.org",
  "@type": type,
  name,
  description,
  url: absoluteUrl(path),
  isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
  ...(type === "ContactPage" && {
    mainEntity: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/"), email: SITE_CONTACT.email, telephone: SITE_CONTACT.phone, address: SITE_CONTACT.address, contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SITE_CONTACT.email, telephone: SITE_CONTACT.phone, areaServed: "IN", availableLanguage: ["English", "Hindi"] } },
  }),
})
