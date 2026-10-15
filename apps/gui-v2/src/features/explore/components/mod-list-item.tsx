import * as React from "react"
import { Download, ExternalLink, Package, Rocket, User } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { openModPortal } from "@/lib/utils"
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

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-all duration-150 ease-out hover:border-foreground/30 hover:bg-[color-mix(in_oklch,var(--card),white_5%)] hover:shadow-md ring-1 ring-transparent hover:ring-foreground/15">
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
            <span className="text-sm font-semibold text-foreground truncate" title={item.title}>
              {item.title}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.category && (
                <Badge variant="outline" className="text-xs font-normal capitalize">
                  {item.category}
                </Badge>
              )}
              {item.requires_space_age && (
                <Badge variant="outline" className="text-xs font-normal gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <Rocket className="size-3 text-amber-500" />
                  Space Age
                </Badge>
              )}
              {item.latest_version && (
                <Badge variant="outline" className="font-mono text-xs font-normal text-muted-foreground">
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

        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-8 px-3 text-xs font-medium cursor-pointer w-full sm:w-auto"
          onClick={() => onDownload?.(item.name)}
        >
          <Download className="size-3.5" />
          <span>Download</span>
        </Button>
      </div>
    </Card>
  )
}
