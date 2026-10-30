import * as React from "react"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModThumbnailProps {
  name: string
  title: string
  thumbnail?: string
  category?: string
  isVirtual?: boolean
  className?: string
}


export function ModThumbnail({
  name,
  title,
  thumbnail,
  category,
  className,
}: ModThumbnailProps) {
  const [imageError, setImageError] = React.useState(false)

  // 1. Extracted Zip Thumbnail or Portal Thumbnail
  if (thumbnail && !imageError) {
    return (
      <div className={cn("size-8 rounded-md overflow-hidden bg-muted border border-border/60 shrink-0 flex items-center justify-center select-none", className)}>
        <img
          src={thumbnail}
          alt={title}
          className="size-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    )
  }

  // 2. Procedural Fallback Avatar with category accents (32px, matches downloads)
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || name.substring(0, 2).toUpperCase()

  const getCategoryColor = (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case "overhaul":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "library":
      case "internal":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "logistics":
      case "transport":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      default:
        return "bg-muted/60 text-muted-foreground border-border/60"
    }
  }

  return (
    <div
      className={cn(
        "size-8 rounded-md flex items-center justify-center font-bold text-[10px] border shrink-0 font-sans select-none",
        getCategoryColor(category),
        className
      )}
    >
      {initials.length > 0 ? initials : <Package className="size-3.5" />}
    </div>
  )
}
