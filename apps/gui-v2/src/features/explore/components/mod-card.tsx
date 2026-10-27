import * as React from "react"
import { Download, ExternalLink, Package, Rocket, User, Plus, Check, Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

interface ModCardProps {
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

export function ModCard({ item, onDownload }: ModCardProps) {
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
    <Card className="flex flex-col justify-between transition-all duration-150 ease-out ring-1 ring-border hover:ring-foreground/20 hover:bg-muted/20 hover:shadow-md dark:ring-transparent dark:hover:ring-foreground/15 dark:hover:bg-[color-mix(in_oklch,var(--card),white_5%)]">
      <div>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
          {item.thumbnail && !imageError ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="size-12 rounded-lg object-cover border border-border shrink-0"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="size-12 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0 text-muted-foreground">
              <Package className="size-6" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-semibold" title={item.title}>
              {item.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs truncate mt-0.5 text-muted-foreground">
              <span className="flex items-center gap-1 truncate min-w-0">
                <User className="size-3 shrink-0" />
                <span className="truncate">{item.owner}</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="shrink-0 flex items-center gap-1">
                <Download className="size-3 shrink-0" />
                <span>{formatDownloads(item.downloads_count)}</span>
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-1">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {item.category && (
              <Badge variant="outline" className="capitalize text-xs font-normal">
                {item.category}
              </Badge>
            )}

            {item.requires_space_age && (
              <Badge variant="outline" className="text-xs gap-1 font-normal text-amber-600 dark:text-amber-400 border-amber-500/30">
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

          {/* Mod Summary */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.summary || "No description provided for this mod."}
          </p>
        </CardContent>
      </div>

      <CardFooter className="bg-transparent border-t border-border/40 px-4 py-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[130px]">
          {item.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
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
              className="gap-1.5 h-8 px-3 text-xs font-medium cursor-default opacity-100 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <Check className="size-3.5 text-emerald-500" />
              <span>Added</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={isAdding}
              className="gap-1.5 h-8 px-3 text-xs font-medium cursor-pointer"
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
      </CardFooter>
    </Card>
  )
}
