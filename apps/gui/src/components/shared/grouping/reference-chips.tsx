import * as React from "react"
import { ArrowUpRight, ArrowDownLeft, BookOpen, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type ReferenceKind = "requires" | "uses" | "required_by" | "used_by" | "requires"

export interface ModReference {
  kind: ReferenceKind | string
  targetName: string
  constraint?: string
  targetTitle?: string
  sourceMod?: string
  installedVersion?: string
}

interface ReferenceChipsProps {
  references?: ModReference[]
  className?: string
  onNavigate?: (targetName: string) => void
}

export function scrollToMod(targetName: string) {
  const el =
    document.getElementById(`mod-row-${targetName}`) ||
    document.getElementById(`group-row-${targetName}`)

  if (el) {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "center",
    })

    // Remove any previous highlight class to restart animation if re-clicked
    el.classList.remove("mod-highlight-active")
    // Force DOM reflow so restarting animation works reliably
    void el.offsetWidth
    el.classList.add("mod-highlight-active")

    setTimeout(() => {
      el.classList.remove("mod-highlight-active")
    }, 2500)
  }
}

export function ReferenceChips({
  references,
  className,
  onNavigate,
}: ReferenceChipsProps) {
  if (!references || references.length === 0) return null

  // Deduplicate by kind + targetName
  const uniqueRefs = Array.from(
    new Map(
      references.map((r) => [`${r.kind}:${r.targetName.toLowerCase()}`, r])
    ).values()
  )

  const handleClick = (e: React.MouseEvent, targetName: string) => {
    e.stopPropagation()
    if (onNavigate) {
      onNavigate(targetName)
    } else {
      scrollToMod(targetName)
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 pt-1", className)}>
      {uniqueRefs.map((ref) => {
        const title = ref.targetTitle || ref.targetName
        const kind = String(ref.kind).toLowerCase()

        let label = title
        let Icon = ArrowUpRight
        let prefix = "Requires"

        if (kind === "requires") {
          prefix = "Requires"
          Icon = ArrowUpRight
        } else if (kind === "uses") {
          prefix = "Uses"
          Icon = BookOpen
        } else if (kind === "required_by" || kind === "requiredby") {
          prefix = "Required by"
          Icon = ArrowDownLeft
        } else if (kind === "used_by" || kind === "usedby") {
          prefix = "Used by"
          Icon = Layers
        }

        return (
          <Tooltip key={`${kind}-${ref.targetName}`}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Jump to ${title}`}
                  onClick={(e) => handleClick(e, ref.targetName)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[11px] font-medium font-sans",
                    "border border-dashed border-border/80 bg-background/50 hover:bg-muted/80 hover:border-primary/50",
                    "text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
                  )}
                />
              }
            >
              <Icon className="size-3 text-muted-foreground/80 shrink-0" />
              <span className="opacity-75">{prefix}</span>
              <span className="font-semibold text-foreground/90">{title}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {prefix} {title}{ref.constraint ? ` (${ref.constraint})` : ""}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
