/** Public URL of a hotel page. Uses the SEO slug, falls back to the id for old hotels without one. */
export const hotelPath = (hotel: { slug?: string; _id: string }) => `/hotels/${hotel.slug || hotel._id}`

/** True for a 24-char MongoDB id (an old-style URL such as /hotels/6a868de767e1c090fa4a8275). */
export const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value)
