import * as React from "react"
import { Download, ExternalLink, Package, Rocket, User, Plus, Check, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { openModPortal } from "@/lib/utils"
import { useModQueueStore } from "@/stores/use-mod-queue-store"
import type { ModSearchResultItem } from "../types"

interface ModListItemProps {
  item: ModSearchResultItem
  onDownload?: (modName: string) => void
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`
  }
  return count.toString()
}

export function ModListItem({ item, onDownload }: ModListItemProps) {
  const [imageError, setImageError] = React.useState(false)
  const [isAdding, setIsAdding] = React.useState(false)

  const isInQueue = useModQueueStore((s) =>
    s.targetMods.some((m) => m.name === item.name)
  )

  const handleQueueClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInQueue || isAdding) return
    setIsAdding(true)
    try {
      await onDownload?.(item.name)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-(--card-spacing) [--card-spacing:--spacing(4)] transition-all duration-150 ease-out ring-1 ring-border hover:ring-foreground/20 hover:bg-muted/20 hover:shadow-md dark:ring-transparent dark:hover:ring-foreground/15 dark:hover:bg-[color-mix(in_oklch,var(--card),white_5%)]">
      {/* Left section: Thumbnail + Main Info */}
      <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
        {item.thumbnail && !imageError ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="size-12 rounded-lg object-cover border border-border/80 shrink-0"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="size-12 rounded-lg bg-muted/60 flex items-center justify-center border border-border/80 shrink-0 text-muted-foreground">
            <Package className="size-6" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header Row: Title + Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate" aria-label={item.title}>
              {item.title}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.category && (
                <Badge variant="outline" className="h-5 capitalize text-xs">
                  {item.category}
                </Badge>
              )}
              {item.requires_space_age && (
                <Badge
                  variant="outline"
                  className="h-5 border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1 text-xs"
                >
                  <Rocket className="size-3 shrink-0" />
                  <span>Space Age</span>
                </Badge>
              )}
              {item.latest_version && (
                <Badge variant="outline" className="h-5 text-muted-foreground text-xs">
                  v{item.latest_version}
                </Badge>
              )}
            </div>
          </div>

          {/* Mod Summary */}
          <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
            {item.summary || "No description provided for this mod."}
          </p>

          {/* Footer Meta Row: Author, Downloads, Mod Name */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate max-w-[140px]">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{item.owner}</span>
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <Download className="size-3.5 shrink-0" />
              <span>{formatDownloads(item.downloads_count)}</span>
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="font-mono text-xs text-muted-foreground/70 truncate">
              {item.name}
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Action Buttons */}
      <div className="flex items-center justify-end gap-2 shrink-0 sm:border-l sm:border-border/40 sm:pl-4">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openModPortal(item.name);
                }}
                aria-label={`Open ${item.title} on Factorio Mod Portal`}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Open on Factorio Mod Portal</TooltipContent>
        </Tooltip>

        {isInQueue ? (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="gap-1.5 h-8 px-3 text-xs font-medium cursor-default opacity-100 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-full sm:w-auto"
          >
            <Check className="size-3.5 text-emerald-500" />
            <span>Added</span>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={isAdding}
            className="gap-1.5 h-8 px-3 text-xs font-medium cursor-pointer w-full sm:w-auto"
            onClick={handleQueueClick}
          >
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>{isAdding ? "Adding..." : "Queue"}</span>
          </Button>
        )}
      </div>
    </Card>
  )
}
