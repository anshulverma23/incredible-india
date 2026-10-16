import { useEffect, useState } from "react"

/** Seconds left until `target` (ISO string). Ticks once a second; returns null when there is no deadline. */
export function useCountdown(target?: string): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null
  return Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000))
}

export const formatCountdown = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
