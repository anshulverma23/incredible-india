import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { PageMeta } from "@/components/common/page-meta"

const meta = (selector: string) => document.head.querySelector<HTMLElement>(selector)

beforeEach(() => {
  document.head.innerHTML = `<title>Default title</title><meta name="description" content="Default description" />`
})
afterEach(() => {
  document.head.innerHTML = ""
})

describe("PageMeta", () => {
  it("sets title, description, canonical, social tags and robots", () => {
    render(<PageMeta title="Hotel X | Site" description="About hotel X" canonical="/hotels/hotel-x" image="https://cdn.test/x.jpg" noindex />)

    expect(document.title).toBe("Hotel X | Site")
    expect(meta('meta[name="description"]')?.getAttribute("content")).toBe("About hotel X")
    expect(meta('link[rel="canonical"]')?.getAttribute("href")).toBe(`${window.location.origin}/hotels/hotel-x`)
    expect(meta('meta[property="og:title"]')?.getAttribute("content")).toBe("Hotel X | Site")
    expect(meta('meta[property="og:image"]')?.getAttribute("content")).toBe("https://cdn.test/x.jpg")
    expect(meta('meta[name="twitter:card"]')?.getAttribute("content")).toBe("summary_large_image")
    expect(meta('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow")
  })

  it("makes a relative share image absolute", () => {
    render(<PageMeta title="T" />)
    expect(meta('meta[property="og:image"]')?.getAttribute("content")).toBe(`${window.location.origin}/images/og-default.jpg`)
  })

  it("writes JSON-LD and escapes '<' so content cannot close the script tag", () => {
    render(<PageMeta title="T" jsonLd={{ "@type": "Hotel", name: "</script><b>x" }} />)
    const script = meta('script[type="application/ld+json"]')
    expect(script?.textContent).toContain('"@type":"Hotel"')
    expect(script?.textContent).not.toContain("</script>")
  })

  it("restores everything when the page unmounts (no tags leak to the next page)", () => {
    const { unmount } = render(<PageMeta title="Hotel X | Site" description="About hotel X" canonical="/hotels/x" noindex jsonLd={{ "@type": "Hotel" }} />)
    unmount()

    expect(document.title).toBe("Default title")
    expect(meta('meta[name="description"]')?.getAttribute("content")).toBe("Default description")
    expect(meta('link[rel="canonical"]')).toBeNull()
    expect(meta('meta[name="robots"]')).toBeNull()
    expect(meta('meta[property="og:title"]')).toBeNull()
    expect(meta('script[type="application/ld+json"]')).toBeNull()
  })
})
