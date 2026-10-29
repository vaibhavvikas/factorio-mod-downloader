import { AlertCircle, AlertTriangle, Copy, Ban } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { HealthIssue } from "../types"

export interface HealthBadgeProps {
  issues?: HealthIssue[]
  factorioIncompatible?: boolean
  factorioVersion?: string | null
  modFactorioVersion?: string | null
  onClick?: (e: React.MouseEvent) => void
}

export function HealthBadge({
  issues,
  factorioIncompatible = false,
  factorioVersion,
  modFactorioVersion,
  onClick,
}: HealthBadgeProps) {
  const allIssues: { kind: string; message: string }[] = []

  if (factorioIncompatible && factorioVersion) {
    allIssues.push({
      kind: "factorio_incompatible",
      message: `Mod requires Factorio ${modFactorioVersion || "unknown"}, which is incompatible with Factorio ${factorioVersion}.`,
    })
  }

  if (issues && issues.length > 0) {
    for (const issue of issues) {
      allIssues.push(issue)
    }
  }

  if (allIssues.length === 0) return null

  const hasFactorioIncompatible = factorioIncompatible && Boolean(factorioVersion)
  const hasConflict = allIssues.some((i) => i.kind === "incompatible_conflict")
  const hasMissing = allIssues.some((i) => i.kind === "missing_dep" || i.kind === "not_installed")
  const hasDisabled = allIssues.some((i) => i.kind === "disabled_dep")
  const hasDuplicate = allIssues.some((i) => i.kind === "duplicate_root_zip")
  const hasMissingVersion = allIssues.some((i) => i.kind === "missing_active_version")

  // Priority order:
  // 1. Incompatible (Factorio version or mod conflict) - prioritized first
  // 2. Not Installed (missing dependency, not present in default location, or no active version)
  // 3. Disabled dependency
  // 4. Duplicate root zips
  // 5. Attention Needed (fallback)
  const getPrimaryIssue = () => {
    if (hasFactorioIncompatible || hasConflict) {
      return {
        label: "Incompatible",
        icon: Ban,
        isDestructive: true,
      }
    }
    if (hasMissing || hasMissingVersion) {
      return {
        label: "Not Installed",
        icon: AlertCircle,
        isDestructive: true,
      }
    }
    if (hasDisabled) {
      return {
        label: "Disabled Dep",
        icon: AlertTriangle,
        isDestructive: false,
      }
    }
    if (hasDuplicate) {
      return {
        label: "Duplicate Zips",
        icon: Copy,
        isDestructive: false,
      }
    }
    return {
      label: "Attention Needed",
      icon: AlertTriangle,
      isDestructive: false,
    }
  }

  const primary = getPrimaryIssue()
  const Icon = primary.icon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            onClick={onClick ? (e) => {
              e.stopPropagation()
              onClick(e)
            } : undefined}
            className={cn(
              "h-5 w-[124px] justify-center px-2 text-[10px] font-medium shrink-0 gap-1.5 select-none transition-all",
              onClick ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-default",
              primary.isDestructive
                ? "border-destructive/50 text-destructive bg-destructive/10"
                : "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
            )}
            aria-label={onClick ? `${primary.label} - Click to resolve` : primary.label}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{primary.label}</span>
          </Badge>
        }
      />
      <TooltipContent side="top">
        {allIssues.length === 1 ? (
          <p>
            {allIssues[0].message}
            {onClick && (hasMissing || hasDisabled) && " (Click to resolve)"}
          </p>
        ) : (
          <div className="space-y-0.5">
            {allIssues.map((issue, idx) => (
              <p key={idx}>{issue.message}</p>
            ))}
            {onClick && (hasMissing || hasDisabled) && (
              <p className="font-semibold text-primary pt-0.5">Click to resolve dependencies</p>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
