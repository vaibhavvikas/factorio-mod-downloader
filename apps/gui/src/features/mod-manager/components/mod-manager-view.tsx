import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Boxes,
  RefreshCw,
  Search,
  HardDrive,
  FolderOpen,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronRight,
  Download,
  MoreVertical,
  ExternalLink,
  Wrench,
  ArrowUpCircle,
} from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import { ModRow } from "./mod-row"
import { ModBulkActions } from "./mod-bulk-actions"
import { ModDetailsPanel } from "./mod-details-panel"
import { ManageVersionsDialog } from "./manage-versions-dialog"
import { UninstallPreviewDialog } from "./uninstall-preview-dialog"
import { ResolveDependenciesDialog } from "./resolve-dependencies-dialog"
import { groupInstalledMods } from "../grouping"
import { NestedRow, ReferenceChips, scrollToMod } from "@/components/shared/grouping"
import { useModManagerStore, type ModFilterTab } from "@/stores/use-mod-manager-store"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import type { InstalledModGroup, ModGroupGraph } from "../types"

function MissingModRow({
  name,
  constraint,
  isFixing = false,
  onFix,
}: {
  name: string
  constraint?: string
  isFixing?: boolean
  onFix?: (name: string, constraint?: string) => void
}) {
  return (
    <div
      id={`mod-row-${name}`}
      className="select-none min-h-[52px] flex items-center justify-between gap-3 px-4 py-2 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="size-8 rounded-md bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center leading-normal">
          <span className="font-semibold text-sm text-destructive truncate">{name}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <span>{constraint ? `Requires ${constraint}` : "Required dependency not installed"}</span>
          </div>
        </div>
      </div>

      {/* Right Column: 3-Dots Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {isFixing ? (
          <div className="size-8 flex items-center justify-center text-destructive">
            <Spinner className="size-4" />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for missing ${name}`}
              className="size-8 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive/80 hover:text-destructive cursor-pointer transition-colors shrink-0 outline-none"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onFix?.(name, constraint)}
              >
                <Download className="size-4 mr-2" />
                <span>Install Dependency</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
                    openUrl(`https://mods.factorio.com/mod/${name}`)
                  })
                }}
              >
                <ExternalLink className="size-4 mr-2" />
                <span>View on Mod Portal</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}


interface ModManagerViewProps {
  isActive?: boolean
}

export function ModManagerView({ isActive }: ModManagerViewProps = {}) {
  const mods = useModManagerStore((s) => s.mods)
  const graphGroups = useModManagerStore((s) => s.graphGroups)
  const storageUsage = useModManagerStore((s) => s.storageUsage)
  const isLoading = useModManagerStore((s) => s.isLoading)
  const isCheckingUpdates = useModManagerStore((s) => s.isCheckingUpdates)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)
  const searchQuery = useModManagerStore((s) => s.searchQuery)
  const filterTab = useModManagerStore((s) => s.filterTab)
  const loadMods = useModManagerStore((s) => s.loadMods)
  const toggleModGroupEnabled = useModManagerStore((s) => s.toggleModGroupEnabled)
  const checkUpdates = useModManagerStore((s) => s.checkUpdates)
  const checkFactorioRunning = useModManagerStore((s) => s.checkFactorioRunning)
  const setFilterTab = useModManagerStore((s) => s.setFilterTab)
  const setSearchQuery = useModManagerStore((s) => s.setSearchQuery)

  const factorioVersion = useSettingsStore((s) => s.factorioVersion)
  const modsFolder = useSettingsStore((s) => s.modsFolder)

  // Dialog states
  const [selectedModForDetails, setSelectedModForDetails] = React.useState<InstalledModGroup | null>(null)
  const [selectedModForVersions, setSelectedModForVersions] = React.useState<InstalledModGroup | null>(null)
  const [uninstallTargets, setUninstallTargets] = React.useState<string[]>([])
  const [isUninstallOpen, setIsUninstallOpen] = React.useState(false)
  const [resolvingMod, setResolvingMod] = React.useState<InstalledModGroup | null>(null)
  const [resolvingGroup, setResolvingGroup] = React.useState<ModGroupGraph | null>(null)
  const [isResolveDialogOpen, setIsResolveDialogOpen] = React.useState(false)

  const handleResolveDependencies = React.useCallback(
    (targetMod: InstalledModGroup, parentGroup?: ModGroupGraph) => {
      setResolvingMod(targetMod)
      if (parentGroup) {
        setResolvingGroup(parentGroup)
      } else {
        const matched = graphGroups.find(
          (g) =>
            g.id === targetMod.name ||
            g.root?.name === targetMod.name ||
            g.children.some((c) => c.name === targetMod.name)
        )
        setResolvingGroup(matched || null)
      }
      setIsResolveDialogOpen(true)
    },
    [graphGroups]
  )

  // Initial load
  React.useEffect(() => {
    loadMods()
    checkFactorioRunning()
  }, [loadMods, checkFactorioRunning])

  // Reload mods when view becomes active
  React.useEffect(() => {
    if (isActive) {
      loadMods(true)
      checkFactorioRunning()
    }
  }, [isActive, loadMods, checkFactorioRunning])

  // Auto check Factorio running status on interval
  React.useEffect(() => {
    const timer = setInterval(() => {
      checkFactorioRunning()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Computed counts
  const totalCount = mods.length
  const enabledCount = mods.filter((m) => m.enabled).length
  const disabledCount = totalCount - enabledCount
  const updatesCount = mods.filter((m) => m.hasUpdate).length

  const isModFactorioIncompatible = React.useCallback(
    (m?: { factorioVersion?: string; isVirtual?: boolean } | null) => {
      if (!m || m.isVirtual) return false
      if (!factorioVersion || factorioVersion === "all" || factorioVersion === "any") return false
      if (!m.factorioVersion) return false
      return !isFactorioVersionCompatible(m.factorioVersion, factorioVersion)
    },
    [factorioVersion]
  )

  const attentionCount = React.useMemo(() => {
    if (graphGroups.length > 0) {
      return graphGroups.filter(
        (g) =>
          g.health.length > 0 ||
          (g.root?.healthIssues?.length ?? 0) > 0 ||
          isModFactorioIncompatible(g.root) ||
          g.children.some(
            (c) =>
              c.missing ||
              (c.healthIssues?.length ?? 0) > 0 ||
              isModFactorioIncompatible(c)
          )
      ).length
    }
    return mods.filter(
      (m) => (m.healthIssues?.length ?? 0) > 0 || isModFactorioIncompatible(m)
    ).length
  }, [graphGroups, mods, isModFactorioIncompatible])

  // Collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({})


  // Compute all unique missing dependencies across installed groups
  const missingDepsList = React.useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const group of graphGroups) {
      for (const child of group.children) {
        if (child.missing) {
          map.set(child.name, child.constraint)
        }
      }
    }
    return Array.from(map.entries()).map(([name, constraint]) => ({ name, constraint }))
  }, [graphGroups])

  const [fixingModNames, setFixingModNames] = React.useState<Set<string>>(new Set())
  const [isFixingAll, setIsFixingAll] = React.useState(false)
  const [isUpdatingAll, setIsUpdatingAll] = React.useState(false)
  const updateAllMods = useModManagerStore((s) => s.updateAllMods)

  const handleUpdateAll = async () => {
    setIsUpdatingAll(true)
    try {
      await updateAllMods()
      toast.add({
        type: "success",
        title: "Updates Started",
        description: `Downloading updates and required dependencies for ${updatesCount} mods`,
      })
    } catch (e: any) {
      toast.add({
        type: "error",
        title: "Update Failed",
        description: typeof e === "string" ? e : e?.message || "Failed to update mods",
        priority: "high",
      })
    } finally {
      setIsUpdatingAll(false)
    }
  }

  const handleFixMissingDeps = async (targets: Array<{ name: string; constraint?: string }>) => {
    if (targets.length === 0) return
    const names = targets.map((t) => t.name)
    setFixingModNames((prev) => new Set([...prev, ...names]))
    if (targets.length > 1) {
      setIsFixingAll(true)
    }

    try {
      const directDeps = targets.map((m) => {
        let ineq = ""
        let version = ""
        if (m.constraint && m.constraint !== "latest") {
          const match = m.constraint.match(/^(=>|==|<=|>=|=|<|>)?\s*(\d+(?:\.\d+)*)/)
          if (match) {
            ineq = match[1] || ""
            if (ineq === "==") ineq = "="
            if (ineq === "=>") ineq = ">="
            version = match[2] || ""
          }
        }
        return {
          id: m.name,
          ineq,
          version,
        }
      })

      const resolved = await invoke<any[]>("resolve_download_batch", {
        mainMods: [],
        directDeps,
        includeRecommended: false,
        factorioVersion: factorioVersion || null,
      })

      let targetModsFolder = await invoke<string | null>("get_mods_folder")
      if (!targetModsFolder) {
        targetModsFolder = await invoke<string>("detect_default_mods_folder")
      }

      await invoke("start_download_batch", {
        items: resolved,
        outputDir: targetModsFolder,
      })

      useDownloadsStore.getState().fetchTasks()
      await loadMods()
    } catch (e: any) {
      console.error("Failed to fix missing dependencies:", e)
      toast.add({
        type: "error",
        title: "Failed to fix missing dependencies",
        description: typeof e === "string" ? e : e?.message || "An error occurred while downloading missing dependencies.",
        priority: "high",
      })
    } finally {
      setIsFixingAll(false)
      setFixingModNames((prev) => {
        const next = new Set(prev)
        names.forEach((n) => next.delete(n))
        return next
      })
    }
  }

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  // Group all installed mods into their full parent-dependency hierarchies
  const allModGroups = React.useMemo(() => {
    return groupInstalledMods(mods)
  }, [mods])

  // Filtered graph groups for grouped view mode
  const filteredGraphGroups = React.useMemo(() => {
    if (graphGroups.length > 0) {
      return graphGroups.filter((group) => {
        let matchesTab = true
        switch (filterTab) {
          case "enabled":
            matchesTab =
              (group.root?.enabled ?? false) ||
              group.children.some((d) => !d.missing && d.enabled)
            break
          case "disabled":
            matchesTab =
              (group.root ? !group.root.enabled : false) ||
              group.children.some((d) => !d.missing && !d.enabled)
            break
          case "updates":
            matchesTab = group.updateCount > 0
            break
          case "attention":
            matchesTab =
              group.health.length > 0 ||
              (group.root?.healthIssues?.length ?? 0) > 0 ||
              isModFactorioIncompatible(group.root) ||
              group.children.some(
                (d) =>
                  d.missing ||
                  (d.healthIssues?.length ?? 0) > 0 ||
                  isModFactorioIncompatible(d)
              )
            break
          default:
            matchesTab = true
            break
        }

        if (!matchesTab) return false

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase()
          const rootMatches =
            group.root &&
            (group.root.title.toLowerCase().includes(q) ||
              group.root.name.toLowerCase().includes(q) ||
              (group.root.author && group.root.author.toLowerCase().includes(q)))

          const depMatches = group.children.some(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.name.toLowerCase().includes(q) ||
              (d.author && d.author.toLowerCase().includes(q))
          )

          if (!rootMatches && !depMatches) return false
        }

        return true
      })
    }

    // Fallback: convert legacy groups to ModGroupGraph
    return allModGroups.map((group): ModGroupGraph => ({
      id: group.parent.name,
      kind: (group.dependencies.length > 0 ? "group" : "standalone") as "group" | "standalone",
      root: group.parent,
      children: group.dependencies.map((d) => ({
        ...d,
        depth: 1,
        via: undefined,
        tag: undefined,
        missing: false,
        constraint: undefined,
      })),
      references: [],
      aggregate: {
        enabled: (group.parent.enabled ? 1 : 0) + group.dependencies.filter((d) => d.enabled).length,
        total: group.dependencies.length + 1,
        state: "all" as const,
      },
      health: group.parent.healthIssues,
      updateCount: (group.parent.hasUpdate ? 1 : 0) + group.dependencies.filter((d) => d.hasUpdate).length,
      tag: null,
    }))
  }, [graphGroups, allModGroups, filterTab, searchQuery])

  const handleGroupToggle = (group: ModGroupGraph, enable: boolean) => {
    toggleModGroupEnabled(group, enable).catch(console.error)
  }

  // Navigate to and highlight target mod/group, expanding collapsed group if needed
  const handleNavigateToMod = React.useCallback(
    (targetName: string) => {
      const lower = targetName.toLowerCase()
      for (const group of filteredGraphGroups) {
        const isTargetInGroup =
          group.id.toLowerCase() === lower ||
          group.root?.name.toLowerCase() === lower ||
          group.children?.some((c) => c.name.toLowerCase() === lower)

        if (isTargetInGroup && collapsedGroups[group.id]) {
          setCollapsedGroups((prev) => ({ ...prev, [group.id]: false }))
          setTimeout(() => scrollToMod(targetName), 60)
          return
        }
      }
      scrollToMod(targetName)
    },
    [filteredGraphGroups, collapsedGroups]
  )

  // Filtered mods for flat view mode
  // All visible mod names for bulk action selection
  const filteredModNames = React.useMemo(() => {
    const names = new Set<string>()
    filteredGraphGroups.forEach((g) => {
      if (g.root) names.add(g.root.name)
      g.children.forEach((d) => {
        if (!d.missing) names.add(d.name)
      })
    })
    return Array.from(names)
  }, [filteredGraphGroups])



  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const handleOpenFolder = () => {
    if (modsFolder) {
      invoke("open_folder_in_explorer", { path: modsFolder }).catch(() => { })
    }
  }

  const handleUninstallSingle = (name: string) => {
    setUninstallTargets([name])
    setIsUninstallOpen(true)
  }

  const handleUninstallMultiple = (names: string[]) => {
    setUninstallTargets(names)
    setIsUninstallOpen(true)
  }

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Boxes className="size-6 text-primary shrink-0" />
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Installed Mods</h2>
            <Badge variant="outline">
              {enabledCount} / {totalCount} Active
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {storageUsage && (
              <span className="flex items-center gap-1 font-mono">
                <HardDrive className="size-3.5 text-primary" />
                <span>Disk: {formatSize(storageUsage.totalBytes)}</span>
                {storageUsage.stashBytes > 0 && (
                  <span className="text-[11px] opacity-75">
                    ({formatSize(storageUsage.stashBytes)} stashed)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 cursor-pointer"
            onClick={handleOpenFolder}
            aria-label="Open mods folder in system file manager"
          >
            <FolderOpen className="size-3.5" />
            <span className="hidden sm:inline">Mods Folder</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 cursor-pointer"
            disabled={isCheckingUpdates || isLoading}
            onClick={() => checkUpdates(factorioVersion)}
            aria-label="Check for updates using fast portal API"
          >
            <RefreshCw className={isCheckingUpdates ? "size-3.5 animate-spin text-primary" : "size-3.5"} />
            <span>{isCheckingUpdates ? "Checking..." : "Check Updates"}</span>
            {updatesCount > 0 && (
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
                {updatesCount}
              </Badge>
            )}
          </Button>

          {updatesCount > 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs gap-1.5 cursor-pointer shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleUpdateAll}
              disabled={isUpdatingAll || isFactorioRunning}
              aria-label={`Update all ${updatesCount} mods to latest versions`}
            >
              {isUpdatingAll ? <Spinner className="size-3.5" /> : <ArrowUpCircle className="size-3.5" />}
              <span>Update All ({updatesCount})</span>
            </Button>
          )}

          {missingDepsList.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs gap-1.5 cursor-pointer shadow-xs"
              onClick={() => handleFixMissingDeps(missingDepsList)}
              disabled={isFixingAll}
              aria-label="Fix and download all missing dependencies"
            >
              {isFixingAll ? <Spinner className="size-3.5" /> : <Wrench className="size-3.5" />}
              <span>Fix All Missing ({missingDepsList.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Factorio Running Banner */}
      {isFactorioRunning && (
        <Alert variant="warning">
          <AlertTriangle className="size-4 shrink-0" />
          <AlertTitle>Factorio is currently running</AlertTitle>
          <AlertDescription>
            Mod version swapping and file deletions are locked while the game is open to prevent access conflicts.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Tabs, View Mode & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-2">
        <Tabs
          value={filterTab}
          onValueChange={(val) => setFilterTab(val as ModFilterTab)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-8 p-0.5 bg-muted/60 text-xs gap-1 select-none font-sans">
            <TabsTrigger value="all" className="text-xs h-7 px-3 cursor-pointer">
              <span>All</span>
              <Badge variant="secondary">{totalCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="enabled" className="text-xs h-7 px-3 cursor-pointer">
              <span>Enabled</span>
              {enabledCount > 0 && (
                <Badge variant="secondary">{enabledCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="disabled" className="text-xs h-7 px-3 cursor-pointer">
              <span>Disabled</span>
              {disabledCount > 0 && (
                <Badge variant="secondary">{disabledCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="updates" className="text-xs h-7 px-3 cursor-pointer">
              <span>Updates</span>
              {updatesCount > 0 && (
                <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900">
                  {updatesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attention" className="text-xs h-7 px-3 cursor-pointer">
              <span>Attention</span>
              {attentionCount > 0 && (
                <Badge variant="destructive">{attentionCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 cursor-pointer shrink-0"
                  disabled={isLoading}
                  onClick={() => loadMods(true)}
                  aria-label="Refresh installed mods"
                >
                  <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
                </Button>
              }
            />
            <TooltipContent side="top">Refresh installed mods</TooltipContent>
          </Tooltip>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter installed mods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Multi-Selection Bulk Action Bar */}
      <ModBulkActions
        filteredModNames={filteredModNames}
        onUninstallSelected={handleUninstallMultiple}
      />

      {/* Mod List Rows (Grouped View) */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <RefreshCw className="size-5 animate-spin text-primary" />
          <span>Scanning installed mods...</span>
        </div>
      ) : filteredGraphGroups.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-lg space-y-2">
          <Package className="size-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-foreground">No mods found</p>
          <p className="max-w-xs mx-auto text-[11px]">
            {searchQuery
              ? `No installed mods match "${searchQuery}".`
              : "No mods found for this filter tab."}
          </p>
        </div>
      ) : (
        /* Grouped View Mode (graph-based) */
        <div className="space-y-3">
          {filteredGraphGroups.map((group) => {
            // Standalone mod with no children
            if (group.kind === "standalone") {
              return (
                <div
                  key={group.id}
                  id={`group-row-${group.id}`}
                  className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
                >
                  {group.root && (
                    <ModRow
                      mod={group.root}
                      isDependency={false}
                      isSingleCard={false}
                      factorioVersion={factorioVersion}
                      onViewDetails={setSelectedModForDetails}
                      onManageVersions={setSelectedModForVersions}
                      onUninstall={handleUninstallSingle}
                      onResolveDependencies={(m) => handleResolveDependencies(m, group)}
                    />
                  )}
                  {group.references && group.references.length > 0 && (
                    <div className="px-4 pb-2 pt-1 border-t border-border/30 bg-muted/10">
                      <ReferenceChips references={group.references} onNavigate={handleNavigateToMod} />
                    </div>
                  )}
                </div>
              )
            }

            // Normal mod group with root + children
            const isCollapsed = !!collapsedGroups[group.id]
            const groupHasUpdate = group.updateCount > 0

            return (
              <div
                key={group.id}
                id={`group-row-${group.id}`}
                className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
              >
                {/* Collapsible Group Header */}
                <div className="w-full min-h-10 px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-between text-xs font-sans text-muted-foreground border-b border-border select-none">
                  <div className="flex items-center gap-2 font-medium text-foreground flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                      className="size-6 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer shrink-0"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    <span className="font-semibold text-sm text-foreground truncate">
                      {group.root?.title || group.id}
                    </span>
                    {group.tag && (
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-amber-500 border-amber-500/40">
                        {group.tag}
                      </Badge>
                    )}
                    <span>•</span>
                    <span className="text-muted-foreground font-normal text-xs shrink-0">
                      {group.aggregate.total} {group.aggregate.total === 1 ? "mod" : "mods"}
                    </span>
                    {groupHasUpdate && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30 shrink-0">
                          <Spinner data-icon="inline-start" />
                          <span>Update</span>
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      onClick={
                        group.aggregate.enabled < group.aggregate.total && group.root
                          ? () => handleResolveDependencies(group.root!, group)
                          : undefined
                      }
                      className={cn(
                        group.aggregate.enabled < group.aggregate.total
                          ? "text-amber-600 dark:text-amber-400 border-amber-500/30 cursor-pointer hover:bg-amber-500/10 active:scale-95 transition-all"
                          : ""
                      )}
                      aria-label={`${group.aggregate.enabled} of ${group.aggregate.total} active`}
                    >
                      {group.aggregate.enabled} / {group.aggregate.total} active
                    </Badge>
                  </div>
                </div>

                {/* Group Rows: Root then children */}
                {!isCollapsed && (
                  <div className="divide-y divide-border/30">
                    {group.root && (
                      <ModRow
                        mod={group.root}
                        isDependency={false}
                        isSingleCard={false}
                        factorioVersion={factorioVersion}
                        onViewDetails={setSelectedModForDetails}
                        onManageVersions={setSelectedModForVersions}
                        onUninstall={handleUninstallSingle}
                        onResolveDependencies={(m) => handleResolveDependencies(m, group)}
                      />
                    )}
                    {(() => {
                      const requiresRefs = (group.references || []).filter(
                        (r) => r.kind === "requires" || r.kind === "uses"
                      )
                      const incomingRefs = (group.references || []).filter(
                        (r) => r.kind === "required_by" || r.kind === "used_by"
                      )

                      return (
                        <>
                          {group.children.map((child, idx) => {
                            const nextChild = group.children[idx + 1]
                            const hasMoreDepth1 =
                              group.children.slice(idx + 1).some((c) => c.depth === 1) || requiresRefs.length > 0
                            const ancestorContinues = child.depth > 1 ? [hasMoreDepth1] : []

                            let isLast = false
                            if (child.depth === 1) {
                              isLast = !hasMoreDepth1
                            } else {
                              isLast = !nextChild || nextChild.depth < child.depth
                            }

                            return (
                              <NestedRow
                                key={child.name}
                                depth={child.depth}
                                ancestorContinues={ancestorContinues}
                                isMissing={child.missing}
                                isLast={isLast}
                              >
                                {child.missing ? (
                                  <MissingModRow
                                    name={child.name}
                                    constraint={child.constraint}
                                    isFixing={fixingModNames.has(child.name)}
                                    onFix={(name, constraint) => handleFixMissingDeps([{ name, constraint }])}
                                  />
                                ) : (
                                  <ModRow
                                    mod={child as unknown as InstalledModGroup}
                                    isDependency={true}
                                    isSingleCard={false}
                                    tag={child.tag}
                                    factorioVersion={factorioVersion}
                                    onViewDetails={setSelectedModForDetails}
                                    onManageVersions={setSelectedModForVersions}
                                    onUninstall={handleUninstallSingle}
                                    onResolveDependencies={(m) => handleResolveDependencies(m, group)}
                                  />
                                )}
                              </NestedRow>
                            )
                          })}

                          {/* Outgoing Required Root Mod Links in Tree */}
                          {requiresRefs.map((ref, idx) => {
                            const isLastRef = idx === requiresRefs.length - 1
                            return (
                              <NestedRow
                                key={`req-${ref.kind}-${ref.targetName}`}
                                depth={1}
                                isLast={isLastRef}
                              >
                                <div className="flex items-center gap-3 px-4 py-2 min-h-[48px]">
                                  <ReferenceChips references={[ref]} onNavigate={handleNavigateToMod} />
                                </div>
                              </NestedRow>
                            )
                          })}

                          {/* Incoming references footer */}
                          {incomingRefs.length > 0 && (
                            <div className="px-4 py-2 border-t border-border/30 bg-muted/10">
                              <ReferenceChips references={incomingRefs} onNavigate={handleNavigateToMod} />
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}


      {/* Mod Details Slide-out Sheet */}
      <ModDetailsPanel
        mod={selectedModForDetails}
        open={!!selectedModForDetails}
        onOpenChange={(open) => !open && setSelectedModForDetails(null)}
        onManageVersions={(m) => {
          setSelectedModForDetails(null)
          setSelectedModForVersions(m)
        }}
      />

      {/* Manage Versions Dialog */}
      <ManageVersionsDialog
        mod={selectedModForVersions}
        open={!!selectedModForVersions}
        onOpenChange={(open) => !open && setSelectedModForVersions(null)}
      />

      {/* Uninstall Confirmation Dialog */}
      <UninstallPreviewDialog
        targets={uninstallTargets}
        open={isUninstallOpen}
        onOpenChange={setIsUninstallOpen}
      />

      {/* Resolve Dependencies Dialog */}
      <ResolveDependenciesDialog
        open={isResolveDialogOpen}
        onOpenChange={setIsResolveDialogOpen}
        mod={resolvingMod}
        group={resolvingGroup}
        allMods={mods}
        factorioVersion={factorioVersion}
      />
    </div>
  )
}
