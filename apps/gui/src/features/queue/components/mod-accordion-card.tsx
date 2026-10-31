import * as React from "react"
import {
  Package,
  Trash2,
  AlertTriangle,
  Download,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  Ban,
  ExternalLink,
} from "lucide-react"
import { cn, openModPortal } from "@/lib/utils"
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useModQueueStore } from "@/stores/use-mod-queue-store"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import type { TargetModItem, TreeNode, DependencyType } from "../types"

interface ModAccordionCardProps {
  mod: TargetModItem
  factorioVersion?: string | null
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

export function ModAccordionCard({
  mod,
  factorioVersion = null,
}: ModAccordionCardProps) {
  const [imageError, setImageError] = React.useState(false)
  const removeTargetMod = useModQueueStore((s) => s.removeTargetMod)
  const updateTargetModVersion = useModQueueStore(
    (s) => s.updateTargetModVersion
  )
  const toggleTargetModDep = useModQueueStore((s) => s.toggleTargetModDep)
  const toggleTargetModSection = useModQueueStore(
    (s) => s.toggleTargetModSection
  )
  const autoIncludeRecommended = useModQueueStore(
    (s) => s.autoIncludeRecommended
  )
  const autoIncludeOptional = useModQueueStore((s) => s.autoIncludeOptional)

  // Version change handler
  const handleVersionChange = (newVersion: string | null) => {
    if (!newVersion) return
    const release = mod.availableReleases.find((r) => r.version === newVersion)
    if (!release) return

    const deps = release.dependencies || {
      required: [],
      recommended: [],
      optional: [],
      incompatible: [],
    }

    const treeNodes: TreeNode[] = []
    const mapDep = (dep: any, type: DependencyType): TreeNode => ({
      id: `dep-${dep.id}-${Math.random()}`,
      name: String(dep.id),
      ineq: dep.ineq,
      version: String(dep.version || ""),
      type,
    })

      ; (deps.required || []).forEach((d) => treeNodes.push(mapDep(d, "required")))
      ; (deps.recommended || []).forEach((d) =>
        treeNodes.push(mapDep(d, "recommended"))
      )
      ; (deps.optional || []).forEach((d) =>
        treeNodes.push(mapDep(d, "optional"))
      )
      ; (deps.incompatible || []).forEach((d) =>
        treeNodes.push(mapDep(d, "incompatible"))
      )

    const initialSelectedIds = treeNodes
      .filter((d) => {
        if (d.type === "required") return true
        if (d.type === "recommended") return autoIncludeRecommended
        if (d.type === "optional") return autoIncludeOptional
        return false
      })
      .map((d) => d.id)

    updateTargetModVersion(mod.id, newVersion, treeNodes, initialSelectedIds)
  }

  // Filter releases supported by the global Factorio version
  const supportedReleases = React.useMemo(() => {
    if (!mod.availableReleases || mod.availableReleases.length === 0) return []
    if (!factorioVersion || factorioVersion === "all" || factorioVersion === "any") {
      return mod.availableReleases
    }
    return mod.availableReleases.filter((rel) =>
      isFactorioVersionCompatible(rel.factorio_version, factorioVersion)
    )
  }, [factorioVersion, mod.availableReleases])

  // Check Factorio version compatibility (true if no releases support target Factorio version)
  const isModIncompatible = React.useMemo(() => {
    if (!factorioVersion || factorioVersion === "all" || factorioVersion === "any")
      return false
    if (!mod.availableReleases || mod.availableReleases.length === 0) return false
    return supportedReleases.length === 0
  }, [factorioVersion, mod.availableReleases, supportedReleases.length])

  // If the user changed the global Factorio version and this mod is already in the queue,
  // automatically update the mod's selected version to the latest supported release.
  React.useEffect(() => {
    if (supportedReleases.length > 0) {
      const isCurrentSupported = supportedReleases.some((r) => r.version === mod.selectedVersion)
      if (!isCurrentSupported) {
        handleVersionChange(supportedReleases[0].version)
      }
    }
  }, [supportedReleases, mod.selectedVersion])

  // Filter dependencies by category
  const requiredDeps = mod.dependencies.filter((d) => d.type === "required")
  const recommendedDeps = mod.dependencies.filter((d) => d.type === "recommended")
  const optionalDeps = mod.dependencies.filter((d) => d.type === "optional")
  const incompatibleDeps = mod.dependencies.filter((d) => d.type === "incompatible")

  const recommendedSelected = recommendedDeps.filter((d) =>
    mod.selectedDepIds.includes(d.id)
  ).length
  const optionalSelected = optionalDeps.filter((d) =>
    mod.selectedDepIds.includes(d.id)
  ).length

  // Total real dependencies (excluding incompatibilities per requirements)
  const totalRealDeps =
    requiredDeps.length + recommendedDeps.length + optionalDeps.length

  const hasNoDeps = totalRealDeps === 0 && incompatibleDeps.length === 0

  // Initial tab selection prioritizes populated tabs
  const defaultTab = React.useMemo(() => {
    if (requiredDeps.length > 0) return "required"
    if (recommendedDeps.length > 0) return "recommended"
    if (optionalDeps.length > 0) return "optional"
    if (incompatibleDeps.length > 0) return "incompatible"
    return "required"
  }, [requiredDeps.length, recommendedDeps.length, optionalDeps.length, incompatibleDeps.length])

  // Find the maximum number of items across any tab for this card
  const maxDepsInCard = Math.max(
    requiredDeps.length,
    recommendedDeps.length,
    optionalDeps.length,
    incompatibleDeps.length
  )

  // In 2 columns, number of rows needed (capped at 3 rows = 6 items max height)
  const rowsNeeded = Math.min(3, Math.max(1, Math.ceil(maxDepsInCard / 2)))

  // Fixed consistent height for all tabs in this card so switching tabs never resizes the card (max height +25px = 151px)
  const tabBodyHeight =
    rowsNeeded === 1 ? "h-[46px]" : rowsNeeded === 2 ? "h-[84px]" : "h-[155px]"

  const currentRelease = mod.availableReleases.find(
    (r) => r.version === mod.selectedVersion
  )

  return (
    <AccordionItem
      value={mod.id}
      disabled={hasNoDeps}
      className="group rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs transition-colors not-last:border-b"
    >
      {/* Card Header (Clean non-nested layout) */}
      <div className="p-4 space-y-3">
        {/* Top Row: Thumbnail + Title/Author on left; Portal Link + Remove button on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            {mod.thumbnail && !imageError ? (
              <img
                src={mod.thumbnail}
                alt={mod.title}
                className="size-11 rounded-lg object-cover border border-border/80 shrink-0 mt-0.5"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="size-11 rounded-lg bg-muted flex items-center justify-center border border-border/80 shrink-0 text-muted-foreground mt-0.5">
                <Package className="size-5" />
              </div>
            )}

            <div className="min-w-0 space-y-1 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-sm font-semibold text-foreground truncate max-w-[260px] sm:max-w-[340px]"
                  aria-label={mod.title}
                >
                  {mod.title}
                </span>

                {mod.category && (
                  <Badge
                    variant="outline"
                    className="capitalize"
                  >
                    {mod.category}
                  </Badge>
                )}

                {isModIncompatible && (
                  <Badge
                    variant="destructive"
                  >
                    <AlertTriangle data-icon="inline-start" />
                    Incompatible
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>by {mod.author}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Download className="size-3" />
                  {formatDownloads(mod.downloadsCount)}
                </span>
                {currentRelease?.factorio_version && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[11px]">
                      Factorio {currentRelease.factorio_version}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="font-mono text-[11px] truncate max-w-[140px] text-muted-foreground/80">
                  {mod.name}
                </span>
              </div>
            </div>
          </div>

          {/* Top-Right Actions: Mod Portal Link + Remove Button */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-primary hover:bg-muted/60 cursor-pointer"
                    onClick={() => openModPortal(mod.name)}
                    aria-label="Open on Mod Portal"
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Open on Factorio Mod Portal</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => removeTargetMod(mod.id)}
                    aria-label="Remove mod from queue"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Remove mod from queue</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Mod Summary if available */}
        {mod.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {mod.summary}
          </p>
        )}

        {/* Bottom Bar: Version Selector + Dep Badges on left; Accordion Trigger on right */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Version Select Dropdown - only shows versions supported by the global Factorio version */}
            {mod.availableReleases && mod.availableReleases.length > 0 && (
              <Select
                value={mod.selectedVersion}
                onValueChange={handleVersionChange}
                disabled={supportedReleases.length === 0}
              >
                <SelectTrigger className="h-8 text-xs font-mono min-w-[130px] w-auto px-2.5 gap-2 border-border/70">
                  <SelectValue placeholder={supportedReleases.length === 0 ? "No compatible version" : "Version"} />
                </SelectTrigger>
                <SelectContent align="start" className="max-h-64 font-mono text-xs min-w-(--anchor-width) w-auto">
                  {supportedReleases.length > 0 ? (
                    supportedReleases.map((rel) => (
                      <SelectItem key={rel.version} value={rel.version} className="text-xs py-1.5 pl-2.5 pr-8">
                        v{rel.version}
                        {rel.factorio_version && ` (${rel.factorio_version})`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={mod.selectedVersion} disabled className="text-xs py-1.5 pl-2.5 pr-8 opacity-60">
                      v{mod.selectedVersion} (Incompatible with Factorio {factorioVersion})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Dependency Badges */}
            {requiredDeps.length > 0 && (
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
                {requiredDeps.length} Required
              </Badge>
            )}
            {recommendedDeps.length > 0 && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30">
                {recommendedSelected}/{recommendedDeps.length} Recommended
              </Badge>
            )}
            {optionalDeps.length > 0 && (
              <Badge variant="outline">
                {optionalSelected}/{optionalDeps.length} Optional
              </Badge>
            )}
            {incompatibleDeps.length > 0 && (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                {incompatibleDeps.length} Incompatible
              </Badge>
            )}
          </div>

          {/* Dedicated Shadcn Accordion Trigger or No Dependencies label */}
          {hasNoDeps ? (
            <div className="flex items-center gap-1.5 py-1 px-2.5 text-xs font-medium text-muted-foreground/50 select-none cursor-default">
              <span>No Dependencies</span>
            </div>
          ) : (
            <AccordionTrigger className="w-auto py-1 px-2.5 text-xs font-medium rounded-md hover:no-underline hover:bg-muted/60 data-[state=open]:bg-muted/40 cursor-pointer gap-1.5 items-center text-muted-foreground hover:text-foreground">
              <span>Dependencies</span>
            </AccordionTrigger>
          )}
        </div>
      </div>

      {/* Accordion Content Panel with 4 Tabs and Dynamic Height */}
      {!hasNoDeps && (
        <AccordionContent className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40 bg-muted/5">
          {/* Factorio Version Incompatibility Warning Banner */}
          {isModIncompatible && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <AlertTitle>Factorio Version Incompatibility</AlertTitle>
              <AlertDescription>
                None of the available releases for this mod specify support for
                Factorio {factorioVersion}. This mod will be skipped during download batch resolution.
              </AlertDescription>
            </Alert>
          )}

          {/* 4 Tabs: Required, Recommended, Optional, Incompatible */}
          <Tabs defaultValue={defaultTab} className="w-full space-y-2.5">
            <TabsList className="h-8 p-0.5 bg-muted/60 text-xs gap-1 w-full grid grid-cols-4 select-none">
              <TabsTrigger
                value="required"
                className="text-xs h-7 px-1.5 gap-1.5 cursor-pointer data-active:bg-background data-active:shadow-xs min-w-0 justify-center"
              >
                <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                <span className="truncate">Required</span>
                <Badge variant="secondary">
                  {requiredDeps.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="recommended"
                className="text-xs h-7 px-1.5 gap-1.5 cursor-pointer data-active:bg-background data-active:shadow-xs min-w-0 justify-center"
              >
                <ThumbsUp className="size-3 text-amber-500 shrink-0" />
                <span className="truncate">Recommended</span>
                <Badge variant="secondary">
                  {recommendedSelected}/{recommendedDeps.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="optional"
                className="text-xs h-7 px-1.5 gap-1.5 cursor-pointer data-active:bg-background data-active:shadow-xs min-w-0 justify-center"
              >
                <Sparkles className="size-3 text-blue-500 shrink-0" />
                <span className="truncate">Optional</span>
                <Badge variant="secondary">
                  {optionalSelected}/{optionalDeps.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="incompatible"
                className="text-xs h-7 px-1.5 gap-1.5 cursor-pointer data-active:bg-background data-active:shadow-xs min-w-0 justify-center"
              >
                <Ban className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">Incompatible</span>
                <Badge variant="secondary">
                  {incompatibleDeps.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Required Tab */}
            <TabsContent value="required" className="mt-0">
              <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/40 text-xs">
                  <span className="text-muted-foreground font-medium">Mandatory dependencies (always downloaded)</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {requiredDeps.length} required
                  </span>
                </div>
                <ScrollArea className={cn("w-full pr-1.5", tabBodyHeight)}>
                  {requiredDeps.length === 0 ? (
                    <div className="h-full min-h-[46px] flex items-center justify-center py-2 text-center text-xs text-muted-foreground italic">
                      No required dependencies for this version.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {requiredDeps.map((dep) => (
                        <div
                          key={dep.id}
                          className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md bg-muted/40 font-mono text-[11px]"
                        >
                          <span className="truncate text-foreground font-medium" aria-label={dep.name}>
                            {dep.name}
                          </span>
                          {dep.version && (
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                              {dep.ineq || ">="} {dep.version}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Recommended Tab */}
            <TabsContent value="recommended" className="mt-0">
              <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/40 text-xs">
                  <span className="text-muted-foreground">Recommended enhancements</span>
                  {recommendedDeps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = recommendedDeps.every((d) =>
                          mod.selectedDepIds.includes(d.id)
                        )
                        toggleTargetModSection(mod.id, "recommended", !allSelected)
                      }}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      {recommendedDeps.every((d) =>
                        mod.selectedDepIds.includes(d.id)
                      )
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>
                <ScrollArea className={cn("w-full pr-1.5", tabBodyHeight)}>
                  {recommendedDeps.length === 0 ? (
                    <div className="h-full min-h-[46px] flex items-center justify-center py-2 text-center text-xs text-muted-foreground italic">
                      No recommended dependencies for this version.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {recommendedDeps.map((dep) => {
                        const isChecked = mod.selectedDepIds.includes(dep.id)
                        return (
                          <label
                            key={dep.id}
                            className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md hover:bg-muted/40 cursor-pointer font-mono text-[11px] transition-colors border border-transparent hover:border-border/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() =>
                                  toggleTargetModDep(mod.id, dep.id)
                                }
                              />
                              <span className="truncate text-foreground" aria-label={dep.name}>
                                {dep.name}
                              </span>
                            </div>
                            {dep.version && (
                              <span className="text-muted-foreground shrink-0 text-[10px]">
                                {dep.ineq || ">="} {dep.version}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Optional Tab */}
            <TabsContent value="optional" className="mt-0">
              <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/40 text-xs">
                  <span className="text-muted-foreground">Optional integrations</span>
                  {optionalDeps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = optionalDeps.every((d) =>
                          mod.selectedDepIds.includes(d.id)
                        )
                        toggleTargetModSection(mod.id, "optional", !allSelected)
                      }}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      {optionalDeps.every((d) =>
                        mod.selectedDepIds.includes(d.id)
                      )
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>
                <ScrollArea className={cn("w-full pr-1.5", tabBodyHeight)}>
                  {optionalDeps.length === 0 ? (
                    <div className="h-full min-h-[46px] flex items-center justify-center py-2 text-center text-xs text-muted-foreground italic">
                      No optional dependencies for this version.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {optionalDeps.map((dep) => {
                        const isChecked = mod.selectedDepIds.includes(dep.id)
                        return (
                          <label
                            key={dep.id}
                            className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md hover:bg-muted/40 cursor-pointer font-mono text-[11px] transition-colors border border-transparent hover:border-border/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() =>
                                  toggleTargetModDep(mod.id, dep.id)
                                }
                              />
                              <span className="truncate text-foreground" aria-label={dep.name}>
                                {dep.name}
                              </span>
                            </div>
                            {dep.version && (
                              <span className="text-muted-foreground shrink-0 text-[10px]">
                                {dep.ineq || ">="} {dep.version}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Incompatible Tab */}
            <TabsContent value="incompatible" className="mt-0">
              <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/40 text-xs">
                  <span className="text-muted-foreground">Known conflicting mods</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {incompatibleDeps.length} incompatible
                  </span>
                </div>
                <ScrollArea className={cn("w-full pr-1.5", tabBodyHeight)}>
                  {incompatibleDeps.length === 0 ? (
                    <div className="h-full min-h-[46px] flex items-center justify-center py-2 text-center text-xs text-muted-foreground italic">
                      No incompatible mods reported for this version.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {incompatibleDeps.map((dep) => (
                        <div
                          key={dep.id}
                          className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md bg-muted/40 font-mono text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Ban className="size-3 text-muted-foreground/70 shrink-0" />
                            <span className="truncate text-foreground" aria-label={dep.name}>
                              {dep.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/80 shrink-0 font-sans">
                            Conflict
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </AccordionContent>
      )}
    </AccordionItem>
  )
}
