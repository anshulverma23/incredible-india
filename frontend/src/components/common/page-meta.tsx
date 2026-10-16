import { useEffect } from "react"

interface PageMetaProps {
  /** Full document title for this route. */
  title?: string
  /** Meta description for this route. */
  description?: string
  /** Canonical path, e.g. "/hotels". Resolved against the current origin. */
  canonical?: string
}

/** Creates the tag on first use, then reuses it on later route changes. */
function upsertMeta(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  apply(el)
}

/**
 * Client-side replacement for the `export const metadata` block Next.js used.
 *
 * Site-wide defaults (Open Graph, Twitter card, JSON-LD, robots) live statically
 * in index.html so crawlers see them without running JS; this component only
 * overrides the per-route title, description and canonical URL.
 */
export function PageMeta({ title, description, canonical }: PageMetaProps) {
  useEffect(() => {
    const previousTitle = document.title
    if (title) document.title = title

    if (description) {
      upsertMeta(
        'meta[name="description"]',
        () => Object.assign(document.createElement("meta"), { name: "description" }),
        (el) => el.setAttribute("content", description)
      )
      // Keep the social preview in sync with the page description.
      upsertMeta(
        'meta[property="og:description"]',
        () => {
          const el = document.createElement("meta")
          el.setAttribute("property", "og:description")
          return el
        },
        (el) => el.setAttribute("content", description)
      )
    }

    if (title) {
      upsertMeta(
        'meta[property="og:title"]',
        () => {
          const el = document.createElement("meta")
          el.setAttribute("property", "og:title")
          return el
        },
        (el) => el.setAttribute("content", title)
      )
    }

    upsertMeta(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement("link"), { rel: "canonical" }),
      (el) => el.setAttribute("href", new URL(canonical ?? window.location.pathname, window.location.origin).href)
    )

    // Restore the previous title when leaving the route.
    return () => {
      document.title = previousTitle
    }
  }, [title, description, canonical])

  return null
}

export default PageMeta
