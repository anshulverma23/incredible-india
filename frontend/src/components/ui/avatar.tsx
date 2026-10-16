import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    />
  )
}

function AvatarImage({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  return (
    // A plain <img> is correct here - avatars are small remote URLs, no loader needed.
    <img data-slot="avatar-image" alt={alt} className={cn("aspect-square size-full object-cover", className)} {...props} />
  )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
