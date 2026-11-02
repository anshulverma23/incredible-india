import { describe, expect, it } from "vitest"
import { absoluteUrl, crumbs, faqJsonLd, itemListJsonLd, pageTitle, SITE_NAME, travelAgencyJsonLd, truncate, webPageJsonLd } from "@/lib/seo"

const origin = window.location.origin

describe("seo helpers", () => {
  it("titles and absolute urls", () => {
    expect(pageTitle("Hotels")).toBe(`Hotels | ${SITE_NAME}`)
    expect(absoluteUrl("/hotels/x")).toBe(`${origin}/hotels/x`)
    expect(absoluteUrl("https://cdn.test/a.jpg")).toBe("https://cdn.test/a.jpg")
  })

  it("truncate cuts on a word boundary and adds an ellipsis", () => {
    expect(truncate("short text")).toBe("short text")
    const out = truncate("word ".repeat(80), 60)
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.endsWith("…")).toBe(true)
    expect(out).not.toMatch(/wor…$/)
  })

  it("breadcrumbs start at Home and are numbered", () => {
    const b = crumbs({ name: "Hotels", path: "/hotels" }, { name: "Taj", path: "/hotels/taj" }) as { itemListElement: { position: number; name: string; item: string }[] }
    expect(b.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", `${origin}/`],
      [2, "Hotels", `${origin}/hotels`],
      [3, "Taj", `${origin}/hotels/taj`],
    ])
  })

  it("item list + FAQ page + agency + contact page", () => {
    const list = itemListJsonLd("Hotels", [{ name: "A", path: "/hotels/a" }]) as { numberOfItems: number }
    expect(list.numberOfItems).toBe(1)

    const faq = faqJsonLd([{ question: "Visa?", answer: "<p>Yes, <b>e-visa</b>.</p>" }]) as { mainEntity: { acceptedAnswer: { text: string } }[] }
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("Yes, e-visa .")

    expect((travelAgencyJsonLd() as { "@type": string })["@type"]).toBe("TravelAgency")
    const contact = webPageJsonLd("ContactPage", "Contact", "/contact", "d") as { mainEntity?: unknown }
    expect(contact.mainEntity).toBeTruthy()
    expect((webPageJsonLd("AboutPage", "About", "/about", "d") as { mainEntity?: unknown }).mainEntity).toBeUndefined()
  })
})
