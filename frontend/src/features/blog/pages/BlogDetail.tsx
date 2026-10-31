import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Calendar,
  User,
  ArrowRight,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/spinner"
import { PageMeta } from "@/components/common/page-meta"
import { absoluteUrl, pageTitle, truncate, SITE_NAME } from "@/lib/seo"

import { blogApi } from "@/features/blog/api/blog.api"
import type { BlogPost } from "@/features/blog/types"

export default function BlogDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>()

  const [blog, setBlog] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchBlog = async () => {
      if (!slug) {
        setError("Blog post not found.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError("")

        const response = await blogApi.getBySlug(slug)

        setBlog(response.blog)
      } catch (error) {
        console.error("Failed to fetch blog:", error)

        setError("Blog post not found.")
      } finally {
        setLoading(false)
      }
    }

    fetchBlog()
  }, [slug])

  if (loading) {
    return <PageLoader label="Loading blog..." />
  }

  if (error || !blog) {
    return (
      <main className="min-h-screen pt-28 pb-20 bg-muted/20">
        <PageMeta title={pageTitle("Blog post not found")} noindex />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-10 text-center">

            <h1 className="text-2xl font-semibold text-foreground">
              Blog not found
            </h1>

            <p className="mt-2 text-muted-foreground">
              {error || "The blog post you're looking for doesn't exist."}
            </p>

            <Button
              className="mt-6"
              render={
                <Link to="/blog">
                  <ArrowLeft className="size-4 mr-2" />
                  Back to Blog
                </Link>
              }
            />

          </Card>
        </div>
      </main>
    )
  }

  return (
    <>
      <PageMeta
        title={pageTitle(blog.title)}
        description={truncate(blog.excerpt)}
        canonical={`/blog/${blog.slug}`}
        image={blog.image}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: blog.title,
          description: truncate(blog.excerpt, 300),
          ...(blog.image && { image: [blog.image] }),
          author: { "@type": "Person", name: blog.author },
          publisher: { "@type": "Organization", name: SITE_NAME },
          datePublished: blog.createdAt || blog.date,
          ...(blog.updatedAt && { dateModified: blog.updatedAt }),
          mainEntityOfPage: absoluteUrl(`/blog/${blog.slug}`),
        }}
      />

      <main className="min-h-screen pt-28 pb-20 bg-muted/20">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Back */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Blog
          </Link>

          {/* Main Card */}
          <Card className="mt-5 overflow-hidden p-0">

            {/* Image */}
            {blog.image && (
              <div className="relative h-[280px] sm:h-[380px] md:h-[450px] overflow-hidden bg-muted">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              </div>
            )}

            {/* Content */}
            <article className="p-6 sm:p-8 md:p-10">

              {/* Tags */}
              {blog.tags && blog.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {blog.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight text-foreground">
                {blog.title}
              </h1>

              {/* Meta */}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">

                <span className="flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  {blog.author}
                </span>

                <span className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  {blog.date}
                </span>

              </div>

              {/* Divider */}
              <div className="my-8 border-t border-border" />

              {/* Excerpt */}
              {blog.excerpt && (
                <div className="rounded-xl bg-muted/50 p-5">
                  <p className="text-base sm:text-lg leading-8 font-medium text-foreground/90">
                    {blog.excerpt}
                  </p>
                </div>
              )}

              {/* Content */}
              <div className="mt-8">

                <div className="whitespace-pre-line text-base sm:text-lg leading-8 text-foreground/90">
                  {blog.content}
                </div>

              </div>

              {/* Bottom */}
              <div className="mt-10 border-t border-border pt-6">

                <Link to="/blog">
                  <Button variant="outline">
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Blog
                  </Button>
                </Link>

              </div>

            </article>

          </Card>

          {/* Related / CTA Card */}
          <Card className="mt-6 p-6 sm:p-8 bg-primary/5 border-primary/10">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">

              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Ready to explore India?
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Discover destinations, hotels and tour packages for your
                  next journey.
                </p>
              </div>

              <Button
                render={
                  <Link to="/destinations">
                    Explore Destinations
                    <ArrowRight className="size-4 ml-2" />
                  </Link>
                }
              />

            </div>

          </Card>

        </div>

      </main>
    </>
  )
}