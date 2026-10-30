/** Public URL of a destination page. Uses the SEO slug, falls back to the id for old destinations without one. */
export const destinationPath = (destination: { slug?: string; _id: string }) => `/destinations/${destination.slug || destination._id}`

/** True for a 24-char MongoDB id (an old-style URL such as /destinations/6a868de767e1c090fa4a8275). */
export const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value)
