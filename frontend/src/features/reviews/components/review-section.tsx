import { useEffect, useState, type FormEvent } from "react"
import { Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/common/star-rating"
import { formatDate } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { reviewApi, type ReviewEligibility } from "@/features/reviews/api/review.api"
import { ApiError } from "@/lib/axios"
import type { Review } from "@/features/reviews/types"

export function ReviewSection({ targetType, targetId }: { targetType: "hotel" | "package"; targetId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [images, setImages] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null)

  const loadReviews = () => {
    setLoading(true)
    const fetcher = targetType === "hotel" ? reviewApi.hotelReviews(targetId) : reviewApi.packageReviews(targetId)
    fetcher
      .then(({ reviews }) => setReviews(reviews))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false))
  }

  // `targetId`/`targetType` are props that can change without remounting this
  // section (switching between hotels/packages), so `loadReviews` has to reset
  // the loading flag itself rather than from an outside click handler.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadReviews, [targetType, targetId])

  // Only guests with a COMPLETED, not-yet-reviewed booking may write a review (checked again by the server).
  const loadEligibility = () => {
    if (!user) return
    reviewApi
      .eligibility(targetType, targetId)
      .then(setEligibility)
      .catch(() => setEligibility(null))
  }
  useEffect(loadEligibility, [user, targetType, targetId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!comment.trim() || !eligibility?.bookingId) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("bookingId", eligibility.bookingId)
      formData.append("rating", String(rating))
      formData.append("comment", comment)
      if (images) Array.from(images).forEach((f) => formData.append("images", f))

      await reviewApi.create(formData)
      toast("Review posted, thank you!")
      setComment("")
      setImages(null)
      loadReviews()
      loadEligibility()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not post your review", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 id="reviews" className="font-serif text-2xl font-bold text-foreground mb-6 scroll-mt-28">
        Reviews {reviews.length > 0 && <span className="text-muted-foreground text-lg">({reviews.length})</span>}
      </h2>

      {user && eligibility && !eligibility.canReview && (
        <p className="mb-6 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {eligibility.reason || "Only guests with a completed booking can leave a review."}
        </p>
      )}

      {user && eligibility?.canReview && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-medium text-foreground">Your rating</p>
          <div className="mb-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
                <Star className={`size-6 ${i <= rating ? "fill-accent text-accent" : "fill-muted text-muted"}`} />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            required
            className="mb-3"
          />
          <div className="flex items-center justify-between gap-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(e.target.files)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
            />
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? "Posting..." : "Post Review"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
      ) : (
        <div className="space-y-5">
          {reviews.map((review) => {
            const reviewer = typeof review.user === "object" ? review.user : null
            const initials = reviewer?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "U"
            return (
              <div key={review._id} className="border-b border-border pb-5 last:border-0">
                <div className="flex items-start gap-3">
                  <Avatar>
                    {reviewer?.avatar?.url ? <AvatarImage src={reviewer.avatar.url} alt={reviewer.name} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{reviewer?.name || "Traveler"}</p>
                      {review.isVerifiedBooking && <Badge className="bg-primary/10 text-primary text-[10px]">Verified stay</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground/90">{review.comment}</p>
                    {review.images.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {review.images.map((img) => (
                          <div key={img.public_id} className="relative size-16 overflow-hidden rounded-lg">
                            <img loading="lazy" decoding="async" src={img.url} alt="Review" className="absolute inset-0 h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
