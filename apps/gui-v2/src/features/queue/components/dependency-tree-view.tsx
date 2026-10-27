import * as React from "react"
import { Layers, ChevronDown, ChevronRight, Package, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { TargetModItem, DependencyType } from "../types"

interface DependencyTreeNodeProps {
  name: string
  versionReq: string
  type: DependencyType | "root"
  targetMods: TargetModItem[]
  visited: Set<string>
  depth: number
}

function DependencyTreeNodeItem({
  name,
  versionReq,
  type = "root",
  targetMods,
  visited,
  depth,
}: DependencyTreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  const modDetails = targetMods.find((m) => m.name === name)
  const displayTitle = modDetails ? modDetails.title || modDetails.name : name

  const hasCycle = visited.has(name)
  const newVisited = new Set(visited).add(name)

  const directDeps = modDetails
    ? modDetails.dependencies.filter((d) => d.type !== "incompatible")
    : []

  const activeSubDeps = directDeps.filter((d) => {
    if (d.type === "required") return true
    return modDetails?.selectedDepIds.includes(d.id)
  })

  const hasChildren = activeSubDeps.length > 0 && !hasCycle

  const getDotColor = () => {
    switch (type) {
      case "root":
        return "bg-primary"
      case "required":
        return "bg-emerald-500"
      case "recommended":
        return "bg-amber-500"
      case "optional":
        return "bg-blue-500"
      default:
        return "bg-muted-foreground"
    }
  }

  return (
    <div className="flex flex-col select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-mono transition-colors hover:bg-muted/40 cursor-pointer",
          depth > 0 && "ml-4 border-l border-border/60 pl-3"
        )}
        onClick={() => hasChildren && setIsExpanded((prev) => !prev)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="size-3 shrink-0" />
        )}

        <span className={cn("size-2 rounded-full shrink-0", getDotColor())} />

        <span className="font-semibold text-foreground truncate">
          {displayTitle}
        </span>

        {name !== displayTitle && (
          <span className="text-[11px] text-muted-foreground opacity-70">
            ({name})
          </span>
        )}

        {versionReq && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            v{versionReq}
          </span>
        )}

        <Badge
          variant="outline"
          className="ml-auto text-[10px] h-4.5 px-1.5 capitalize font-normal font-sans"
        >
          {type}
        </Badge>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {activeSubDeps.map((dep) => (
            <DependencyTreeNodeItem
              key={dep.id}
              name={dep.name}
              versionReq={dep.version}
              type={dep.type}
              targetMods={targetMods}
              visited={newVisited}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DependencyTreeViewProps {
  targetMods: TargetModItem[]
}

export function DependencyTreeView({ targetMods }: DependencyTreeViewProps) {
  // Determine root mods (target mods that are not depended upon by any other selected card)
  const rootMods = React.useMemo(() => {
    const allDepNames = new Set<string>()
    targetMods.forEach((m) => {
      m.dependencies.forEach((d) => {
        if (d.type === "required" || m.selectedDepIds.includes(d.id)) {
          allDepNames.add(d.name)
        }
      })
    })
    const roots = targetMods.filter((m) => !allDepNames.has(m.name))
    return roots.length > 0 ? roots : targetMods
  }, [targetMods])

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-xs">
      {/* Legend & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Dependency Graph Explorer
          </h3>
          <Badge variant="secondary" className="text-[10px] font-mono font-bold h-5 px-1.5">
            {targetMods.length} root target mods
          </Badge>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> Root
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Required
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> Recommended
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" /> Optional
          </span>
        </div>
      </div>

      {/* Nodes Tree */}
      <div className="flex flex-col gap-1 p-2 bg-muted/20 rounded-lg">
        {rootMods.map((m) => (
          <DependencyTreeNodeItem
            key={m.id}
            name={m.name}
            versionReq={m.selectedVersion}
            type="root"
            targetMods={targetMods}
            visited={new Set()}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}
