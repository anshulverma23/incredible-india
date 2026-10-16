import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * Next.js scrolled to the top on every route change; React Router does not.
 * Mounted once in the root layout to restore that behaviour.
 * Hash links (#section) are left alone so in-page anchors still work.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior })
  }, [pathname, hash])

  return null
}

export default ScrollToTop
