import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Users, Star, ArrowRight } from "lucide-react"
import { packageApi } from "@/features/packages/api/package.api"
import { packagePath } from "@/features/packages/lib/package-path"
import type { TourPackage } from "@/features/packages/types"

export function Tours() {
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    packageApi
      .list({ limit: 4 })
      .then((res) => {
        if (!ignore) {
          setPackages((res.packages as TourPackage[]) || [])
        }
      })
      .catch((err) => console.error("Failed to fetch packages:", err))
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section id="tours" className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="text-accent font-medium text-sm uppercase tracking-widest mb-4">
              Featured Tours
            </p>
            <h2 className="font-manrope text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-balance">
              Handcrafted Journeys for Every Traveler
            </h2>
          </div>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground self-start md:self-auto"
            render={<Link to="/packages" />}
          >
            View All Packages
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* Tours Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {loading ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              Loading featured packages...
            </div>
          ) : packages.length === 0 ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              No packages found.
            </div>
          ) : (
            packages.map((pkg) => (
              <Card
                key={pkg._id}
                className="group overflow-hidden border-border/50 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row h-full">
                  <div className="relative lg:w-2/5 aspect-[4/3] lg:aspect-auto h-full min-h-[250px]">
                    <img
                      loading="lazy" decoding="async"
                      src={pkg.gallery?.[0]?.url || "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?q=80&w=2069&auto=format&fit=crop"}
                      alt={pkg.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground">
                      {pkg.packageType || "Featured"}
                    </Badge>
                  </div>
                  <CardContent className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-accent mb-2">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">{pkg.rating || 5.0}</span>
                      </div>
                      <h3 className="font-manrope text-xl font-bold text-foreground mb-2 line-clamp-1">
                        {pkg.name}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 text-pretty line-clamp-3">
                        {pkg.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{pkg.duration?.days}D / {pkg.duration?.nights}N</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>Max {pkg.maxGroupSize || 10}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            From
                          </span>
                          <p className="font-serif text-2xl font-bold text-primary">
                            ₹{pkg.price?.toLocaleString()}
                          </p>
                        </div>
                        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" render={<Link to={packagePath(pkg)} />}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
