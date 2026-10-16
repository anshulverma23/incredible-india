/** "just now", "5m ago", "3h ago", "2d ago", otherwise a short date. */
export function timeAgo(date: string | Date): string {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}
