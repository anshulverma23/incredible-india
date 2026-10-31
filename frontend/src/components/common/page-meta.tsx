import { useEffect } from "react"
import { DEFAULT_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/seo"

interface PageMetaProps {
  /** Full document title for this route (use pageTitle("...")). */
  title?: string
  /** Meta description for this route (use truncate(...) for long text). */
  description?: string
  /** Canonical path, e.g. "/hotels" (no query string). Defaults to the current path. */
  canonical?: string
  /** Share image (absolute URL or a /path). Defaults to the site share image. */
  image?: string
  /** Open Graph type. "article" for blog posts. */
  type?: "website" | "article"
  /** Private / thin pages (admin, login, checkout, 404): tells search engines not to index them. */
  noindex?: boolean
  /** Structured data (schema.org) for this page. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

type Restore = () => void

/** Creates the tag if needed, sets its value, and returns a function that puts the page back exactly as it was. */
function setTag(selector: string, create: () => HTMLElement, attr: "content" | "href", value: string): Restore {
  let el = document.head.querySelector<HTMLElement>(selector)
  const created = !el
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  const target = el
  const previous = target.getAttribute(attr)
  target.setAttribute(attr, value)
  return () => {
    if (created) target.remove()
    else if (previous === null) target.removeAttribute(attr)
    else target.setAttribute(attr, previous)
  }
}

const nameMeta = (name: string, value: string) =>
  setTag(`meta[name="${name}"]`, () => Object.assign(document.createElement("meta"), { name }), "content", value)

const propertyMeta = (property: string, value: string) =>
  setTag(
    `meta[property="${property}"]`,
    () => {
      const el = document.createElement("meta")
      el.setAttribute("property", property)
      return el
    },
    "content",
    value
  )

/**
 * Per-route <title>, description, canonical, Open Graph / Twitter tags, robots and JSON-LD.
 *
 * Site-wide defaults live statically in index.html (so crawlers that do not run JavaScript still see
 * something). This component overrides them while the page is mounted and RESTORES them when the
 * page unmounts, so a page without <PageMeta> never inherits the previous page's tags.
 */
export function PageMeta({ title, description, canonical, image, type = "website", noindex, jsonLd }: PageMetaProps) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd).replace(/</g, "\\u003c") : ""

  useEffect(() => {
    const restores: Restore[] = []
    const previousTitle = document.title
    if (title) document.title = title

    const url = absoluteUrl(canonical ?? window.location.pathname)
    const shareImage = absoluteUrl(image || DEFAULT_IMAGE)

    restores.push(setTag('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url))
    restores.push(propertyMeta("og:url", url))
    restores.push(propertyMeta("og:type", type))
    restores.push(propertyMeta("og:site_name", SITE_NAME))
    restores.push(propertyMeta("og:image", shareImage))
    restores.push(nameMeta("twitter:card", "summary_large_image"))
    restores.push(nameMeta("twitter:image", shareImage))

    if (title) {
      restores.push(propertyMeta("og:title", title))
      restores.push(nameMeta("twitter:title", title))
    }
    if (description) {
      restores.push(nameMeta("description", description))
      restores.push(propertyMeta("og:description", description))
      restores.push(nameMeta("twitter:description", description))
    }
    if (noindex) restores.push(nameMeta("robots", "noindex, nofollow"))

    if (jsonLdText) {
      const script = document.createElement("script")
      script.type = "application/ld+json"
      script.dataset.pageMeta = "true"
      script.textContent = jsonLdText
      document.head.appendChild(script)
      restores.push(() => script.remove())
    }

    return () => {
      document.title = previousTitle
      restores.reverse().forEach((restore) => restore())
    }
  }, [title, description, canonical, image, type, noindex, jsonLdText])

  return null
}

export default PageMeta
