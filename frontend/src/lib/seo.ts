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
