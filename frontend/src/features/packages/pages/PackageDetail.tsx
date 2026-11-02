import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, X, MapPin, MessagesSquare, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageLoader } from "@/components/ui/spinner"
import { StarRating } from "@/components/common/star-rating"
import { PageMeta } from "@/components/common/page-meta"
import { absoluteUrl, crumbs, pageTitle, truncate } from "@/lib/seo"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import { ReviewSection } from "@/features/reviews/components/review-section"
import { formatINR } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { packageApi } from "@/features/packages/api/package.api"
import { isObjectId, packagePath } from "@/features/packages/lib/package-path"
import { EnquiryModal } from "@/features/enquiries/components/enquiry-modal"
import type { TourPackage } from "@/features/packages/types"

export default function PackageDetailsPage() {
  // URL is /packages/:slug (old links with the MongoDB id still work and are redirected to the slug)
  const { slug = "" } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [pkg, setPkg] = useState<TourPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)

  const [enquiryOpen, setEnquiryOpen] = useState(false)

  useEffect(() => {
    packageApi
      .get(slug)
      .then((res) => {
        setPkg(res.package)
        // Old id-based link -> show the SEO slug in the address bar
        if (isObjectId(slug) && res.package.slug && res.package.slug !== slug) {
          navigate(packagePath(res.package), { replace: true })
        }
      })
      .catch(() => setPkg(null))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  if (loading) return <PageLoader label="Loading package..." />
  if (!pkg) return (
    <main className="min-h-screen pt-32 pb-20 text-center">
      <PageMeta title={pageTitle("Package not found")} noindex />
      <p className="text-muted-foreground">Package not found.</p>
    </main>
  )

  const destinationName = typeof pkg.destination === "object" ? pkg.destination.name : ""
  const images = pkg.gallery

  const handleDiscuss = () => {
    if (!user) {
      navigate("/login")
      return
    }
    setEnquiryOpen(true)
  }

  const metaDescription = truncate(pkg.description)

  return (
    <main className="min-h-screen pt-24 pb-20 bg-background">
      <PageMeta
        title={pageTitle(`${pkg.name} - ${pkg.duration.days}D/${pkg.duration.nights}N Tour Package`)}
        description={metaDescription}
        canonical={packagePath(pkg)}
        image={images[0]?.url}
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": ["TouristTrip", "Product"],
          name: pkg.name,
          description: truncate(pkg.description, 300),
          url: absoluteUrl(packagePath(pkg)),
          ...(images.length > 0 && { image: images.map((img) => img.url) }),
          touristType: pkg.packageType,
          ...(destinationName && { itinerary: { "@type": "Place", name: destinationName } }),
          offers: {
            "@type": "AggregateOffer", // "from" price: the final price is quoted after the customer discusses the package
            lowPrice: pkg.price,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(packagePath(pkg)),
          },
          ...(pkg.numReviews > 0 && { aggregateRating: { "@type": "AggregateRating", ratingValue: pkg.rating, reviewCount: pkg.numReviews } }),
        }, crumbs({ name: "Tour Packages", path: "/packages" }, { name: pkg.name, path: packagePath(pkg) })]}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="relative aspect-[16/8] overflow-hidden rounded-2xl bg-muted">
            {images[activeImage] ? (
              <img loading="lazy" decoding="async" src={images[activeImage].url} alt={pkg.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
            )}
            <div className="absolute right-4 top-4">
              <WishlistButton itemType="Package" itemId={pkg._id} />
            </div>
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.public_id}
                  onClick={() => setActiveImage(i)}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImage ? "border-primary" : "border-transparent"}`}
                >
                  <img loading="lazy" decoding="async" src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <Badge className="mb-3 bg-primary/10 text-primary">{pkg.packageType}</Badge>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{pkg.name}</h1>
            {destinationName && (
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" /> {destinationName}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <StarRating rating={pkg.rating} size="md" />
              <span className="text-sm text-muted-foreground">{pkg.duration.days} Days / {pkg.duration.nights} Nights</span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="size-3.5" /> Max {pkg.maxGroupSize}</span>
            </div>

            <p className="mt-6 leading-relaxed text-foreground/90">{pkg.description}</p>

            {pkg.itinerary.length > 0 && (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-4">Itinerary</h2>
                <div className="space-y-4">
                  {pkg.itinerary.map((day) => (
                    <div key={day.day} className="flex gap-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif font-bold text-primary">
                        {day.day}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{day.title}</p>
                        {day.description && <p className="text-sm text-muted-foreground">{day.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {pkg.included.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Included</h3>
                  <ul className="space-y-2 text-sm">
                    {pkg.included.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-foreground/90"><Check className="size-4 text-primary shrink-0" /> {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.excluded.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Excluded</h3>
                  <ul className="space-y-2 text-sm">
                    {pkg.excluded.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-muted-foreground"><X className="size-4 text-destructive shrink-0" /> {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {pkg.amenities && pkg.amenities.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 font-semibold text-foreground">Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {pkg.amenities.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
                </div>
              </div>
            )}

            <div className="mt-10">
              <ReviewSection targetType="package" targetId={pkg._id} />
            </div>
          </div>

          {/* Discuss & customise: the customer talks to us first, gets a quotation, then pays */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl font-bold text-foreground">{pkg.name}</h2>
                <Badge variant="secondary">Customizable</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">From</p>
              <p className="font-serif text-3xl font-bold text-foreground">{formatINR(pkg.price)}<span className="text-sm font-normal text-muted-foreground"> /person</span></p>
              <p className="mt-2 text-sm text-muted-foreground">{pkg.duration.days} Days · {pkg.duration.nights} Nights{destinationName ? ` · ${destinationName}` : ""}</p>

              <Button onClick={handleDiscuss} className="mt-4 w-full bg-primary py-5 text-primary-foreground hover:bg-primary/90">
                <MessagesSquare className="size-4" /> Discuss This Package
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">Share your travel requirements and get a personalized quotation. No payment is needed now.</p>

              <ol className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li><strong className="text-foreground">1.</strong> Tell us your dates, travellers and budget</li>
                <li><strong className="text-foreground">2.</strong> Our expert customises hotels, transport and activities</li>
                <li><strong className="text-foreground">3.</strong> Review the final quotation - accept, change or negotiate</li>
                <li><strong className="text-foreground">4.</strong> Pay in full or an advance and get your confirmation + invoice</li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
      {enquiryOpen && <EnquiryModal pkg={pkg} open={enquiryOpen} onOpenChange={setEnquiryOpen} />}
    </main>
  )
}
