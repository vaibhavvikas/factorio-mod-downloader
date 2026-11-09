import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupHeaderProps {
  id?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  isExpanded: boolean
  onToggleExpand: () => void
  summary?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  tag?: string | null
}

export function GroupHeader({
  id,
  title,
  subtitle,
  isExpanded,
  onToggleExpand,
  summary,
  actions,
  className,
  tag,
}: GroupHeaderProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-card/60 hover:bg-card/90 border border-border/50 transition-colors select-none",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse group" : "Expand group"}
          onClick={onToggleExpand}
          className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-transform cursor-pointer shrink-0"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{title}</span>
            {tag && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-500">
                {tag}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {summary}
        {actions}
      </div>
    </div>
  )
}

