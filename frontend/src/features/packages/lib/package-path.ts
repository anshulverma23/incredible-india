/** Public URL of a package page. Uses the SEO slug, falls back to the id for old packages without one. */
export const packagePath = (pkg: { slug?: string; _id: string }) => `/packages/${pkg.slug || pkg._id}`

/** True for a 24-char MongoDB id (an old-style URL such as /packages/665f1c2e8f1b2c0012345001). */
export const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value)
