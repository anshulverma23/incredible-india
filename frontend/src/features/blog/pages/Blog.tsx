import { PageMeta } from "@/components/common/page-meta"
import { pageTitle } from "@/lib/seo"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Calendar, User } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageLoader } from "@/components/ui/spinner"

import { blogApi } from "@/features/blog/api/blog.api"
import type { BlogPost } from "@/features/blog/types"

export default function Blog() {
  const [blogs, setBlogs] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setLoading(true)
        setError("")

        const response = await blogApi.list()

        setBlogs(response.blogs)
      } catch (error) {
        console.error("Failed to fetch blogs:", error)
        setError("Failed to load blogs. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchBlogs()
  }, [])

  if (loading) {
    return <PageLoader label="Loading travel stories..." />
  }

  if (error) {
    return (
      <main className="min-h-screen pt-28 pb-20 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-10 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Something went wrong
            </h2>

            <p className="mt-2 text-muted-foreground">
              {error}
            </p>

            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-28 pb-20 bg-muted/20">
      <PageMeta title={pageTitle("Travel Blog - India Travel Stories & Tips")} description="Travel stories, destination guides and practical tips for planning your trip to India." canonical="/blog" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            India Travel Journal
          </p>

          <h1 className="mt-2 font-serif text-3xl md:text-4xl font-bold text-foreground">
            Travel Stories & Guides
          </h1>

          <p className="mt-3 max-w-2xl text-muted-foreground">
            Discover travel tips, destinations, itineraries and local
            experiences to help you plan your perfect journey across India.
          </p>
        </div>

        {/* Empty State */}
        {blogs.length === 0 ? (
          <Card className="p-10 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              No blog posts found
            </h2>

            <p className="mt-2 text-muted-foreground">
              Check back soon for new travel stories.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {blogs.map((blog) => (
              <Card
                key={blog._id}
                className="group overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >

                {/* Image */}
                <Link to={`/blog/${blog.slug}`}>
                  <div className="relative h-56 overflow-hidden bg-muted">
                    {blog.image ? (
                      <img
                        src={blog.image}
                        alt={blog.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        No image
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  </div>
                </Link>

                {/* Content */}
                <div className="p-5">

                  {/* Tags */}
                  {blog.tags && blog.tags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {blog.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <Link to={`/blog/${blog.slug}`}>
                    <h2 className="line-clamp-2 text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                      {blog.title}
                    </h2>
                  </Link>

                  {/* Excerpt */}
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {blog.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">

                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5" />
                      {blog.author}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {blog.date}
                    </span>

                  </div>

                  {/* Read */}
                  <Link
                    to={`/blog/${blog.slug}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Read article
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                </div>
              </Card>
            ))}

          </div>
        )}
      </div>
    </main>
  )
}