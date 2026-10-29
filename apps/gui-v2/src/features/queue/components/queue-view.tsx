import * as React from "react"
import {
  Package,
  Plus,
  Loader2,
  Download,
  Trash2,
  LayoutGrid,
  Layers,
  ArrowRight,
  Inbox,
  AlertCircle,
  Gamepad2,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion } from "@/components/ui/accordion"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useModQueueStore } from "@/stores/use-mod-queue-store"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useSettingsStore, DEFAULT_FACTORIO_VERSIONS } from "@/stores/use-settings-store"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import { ModAccordionCard } from "./mod-accordion-card"
import { DependencyTreeView } from "./dependency-tree-view"
import { QueueSettingsPopover } from "./queue-settings-popover"
import type {
  TargetModItem,
  TreeNode,
  DependencyType,
  BackendModDetails,
  BackendResolvedDownloadItem,
  BackendDependency,
} from "../types"

interface QueueViewProps {
  onNavigateToExplore?: () => void
  factorioVersion?: string | null
}

export function QueueView({
  onNavigateToExplore,
  factorioVersion: propFactorioVersion = null,
}: QueueViewProps) {
  const storeFactorioVersion = useSettingsStore((s) => s.factorioVersion)
  const factorioVersion = propFactorioVersion ?? storeFactorioVersion
  const targetMods = useModQueueStore((s) => s.targetMods)
  const addTargetMod = useModQueueStore((s) => s.addTargetMod)
  const clearTargetMods = useModQueueStore((s) => s.clearTargetMods)
  const autoIncludeRecommended = useModQueueStore(
    (s) => s.autoIncludeRecommended
  )
  const autoIncludeOptional = useModQueueStore((s) => s.autoIncludeOptional)
  const addToQueue = useModQueueStore((s) => s.addToQueue)
  const expandedCardIds = useModQueueStore((s) => s.expandedCardIds)
  const setExpandedCardIds = useModQueueStore((s) => s.setExpandedCardIds)

  const [inputQuery, setInputQuery] = React.useState("")
  const [isAdding, setIsAdding] = React.useState(false)
  const [isResolving, setIsResolving] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"cards" | "tree">("cards")

  // When global factorioVersion changes, ensure all already-added mods in the queue update their selected version
  React.useEffect(() => {
    if (factorioVersion) {
      useModQueueStore.getState().updateAllModVersionsForFactorio(factorioVersion)
    }
  }, [factorioVersion])

  // Helper to fetch details and add a single mod to the queue
  const handleAddModByName = async (rawName: string) => {
    let modId = rawName.trim()
    if (!modId) return

    // Parse Factorio portal URL if pasted
    if (modId.startsWith("http://") || modId.startsWith("https://")) {
      try {
        const url = new URL(modId)
        const parts = url.pathname.split("/").filter(Boolean)
        const modIdx = parts.indexOf("mod")
        if (modIdx !== -1 && parts[modIdx + 1]) {
          modId = parts[modIdx + 1]
        } else {
          modId = parts[parts.length - 1]
        }
      } catch {
        // use as is
      }
    }

    if (targetMods.some((m) => m.name.toLowerCase() === modId.toLowerCase())) {
      setErrorMessage(`Mod "${modId}" is already in your queue.`)
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    setIsAdding(true)

    try {
      const details = await invoke<BackendModDetails>("fetch_mod_details", {
        modId,
      })

      const reversedReleases = (details.releases || []).slice().reverse()
      const compatibleReleases = reversedReleases.filter((r) =>
        isFactorioVersionCompatible(r.factorio_version, factorioVersion)
      )

      const bestRelease =
        compatibleReleases.length > 0 ? compatibleReleases[0] : reversedReleases[0]
      const latestVersion = bestRelease?.version || "latest"

      const releaseDeps = bestRelease?.dependencies ||
        details.default_dependencies || {
        required: [],
        recommended: [],
        optional: [],
        incompatible: [],
      }

      const treeNodes: TreeNode[] = []
      const mapDep = (dep: BackendDependency, type: DependencyType): TreeNode => ({
        id: `dep-${dep.id}-${Math.random()}`,
        name: String(dep.id),
        ineq: dep.ineq,
        version: String(dep.version || ""),
        type,
      })

        ; (releaseDeps.required || []).forEach((d) =>
          treeNodes.push(mapDep(d, "required"))
        )
        ; (releaseDeps.recommended || []).forEach((d) =>
          treeNodes.push(mapDep(d, "recommended"))
        )
        ; (releaseDeps.optional || []).forEach((d) =>
          treeNodes.push(mapDep(d, "optional"))
        )
        ; (releaseDeps.incompatible || []).forEach((d) =>
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

      const newCard: TargetModItem = {
        id: `mod-${Date.now()}-${Math.random()}`,
        name: details.name,
        title: details.title || details.name,
        author: details.owner || "Author",
        category: details.category || "content",
        summary: details.summary || "",
        thumbnail: details.thumbnail,
        updatedAt: details.updated_at,
        downloadsCount: details.downloads_count || 0,
        selectedVersion: latestVersion,
        availableReleases: reversedReleases,
        selectedDepIds: initialSelectedIds,
        dependencies: treeNodes,
      }

      addTargetMod(newCard)
    } catch (err: any) {
      console.error(err)
      setErrorMessage(`Failed to add mod: ${String(err)}`)
      setTimeout(() => setErrorMessage(null), 4000)
    } finally {
      setIsAdding(false)
    }
  }

  // Submit search / paste form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputQuery.trim() || isAdding) return

    const entries = inputQuery.split(/[\n\r,]+/)
    setInputQuery("")

    for (const entry of entries) {
      if (entry.trim()) {
        await handleAddModByName(entry.trim())
      }
    }
  }



  // Check how many compatible mods are ready to download
  const compatibleMods = React.useMemo(() => {
    return targetMods.filter((mod) => {
      if (!factorioVersion || factorioVersion === "all" || factorioVersion === "any")
        return true
      if (!mod.availableReleases || mod.availableReleases.length === 0) return true
      return mod.availableReleases.some((rel) =>
        isFactorioVersionCompatible(rel.factorio_version, factorioVersion)
      )
    })
  }, [targetMods, factorioVersion])

  // Start download batch
  const handleStartDownloadAll = async () => {
    if (compatibleMods.length === 0 || isResolving) return

    setIsResolving(true)
    try {
      const mainMods: BackendResolvedDownloadItem[] = compatibleMods.map((t) => ({
        id: t.name,
        title: t.title || t.name,
        version: t.selectedVersion,
        file_name: `${t.name}_${t.selectedVersion}.zip`,
        sha1: "",
        reason: "direct",
      }))

      const directDeps: BackendDependency[] = []
      compatibleMods.forEach((t) => {
        t.dependencies.forEach((d) => {
          if (t.selectedDepIds.includes(d.id)) {
            directDeps.push({
              id: d.name,
              ineq: d.ineq || ">=",
              version: d.version,
            })
          }
        })
      })

      const cleanFactorioVer =
        !factorioVersion || factorioVersion === "all" || factorioVersion === "any"
          ? null
          : factorioVersion

      const resolvedBatch = await invoke<BackendResolvedDownloadItem[]>(
        "resolve_download_batch",
        {
          mainMods,
          directDeps,
          includeRecommended: false,
          factorioVersion: cleanFactorioVer,
        }
      )

      let modsFolder = await invoke<string | null>("get_mods_folder")
      if (!modsFolder) {
        modsFolder = await invoke<string>("detect_default_mods_folder")
      }

      // Register download groups with useDownloadsStore so parent-child relationships are preserved
      const groupsToRegister = targetMods.map((m) => ({
        parent: m.name,
        dependencies: m.dependencies
          .filter(
            (d) =>
              (d.type === "required" || m.selectedDepIds.includes(d.id)) &&
              !["base", "space-age", "quality", "elevated-rails", "recycler"].includes(d.name)
          )
          .map((d) => d.name),
      }))
      useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

      await invoke("start_download_batch", {
        items: resolvedBatch,
        outputDir: modsFolder,
      })

      useDownloadsStore.getState().fetchTasks()

      // Update active queue tracker in store
      resolvedBatch.forEach((item) => {
        addToQueue({
          name: item.id,
          title: item.title || item.id,
          owner: "",
          version: item.version,
        })
      })
    } catch (err: any) {
      console.error(err)
      setErrorMessage(`Resolution error: ${String(err)}`)
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <div className="@container p-6 w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <Package className="size-6 text-primary shrink-0" />
          <h2 className="text-xl font-bold tracking-tight text-foreground uppercase font-sans">
            Mod Queue Manager
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-sans">
          Manage queued mods, resolve dependencies, select releases, and batch download to your Factorio mods folder.
        </p>
      </div>

      {/* Controls Bar: Add Input on left, Tools & Download on right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
        {/* Left: Input for adding mods */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Add mod by name, portal URL, or comma-separated list..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isAdding}
            className="h-8 w-72 sm:w-96 md:w-[440px] text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isAdding}
            className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
          >
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>Add</span>
          </Button>
        </form>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Inline Factorio Version Selector */}
          <Select
            value={factorioVersion || "2.1"}
            onValueChange={(val) => {
              if (val) {
                useSettingsStore.getState().setFactorioVersion(val)
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs font-medium border-border/80 px-2.5 gap-2 cursor-pointer">
              <SelectValue>
                {(value: string) => {
                  const opt = DEFAULT_FACTORIO_VERSIONS.find((v) => v.value === value)
                  return (
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{opt?.label ?? (value === "any" ? "Any Version" : value)}</span>
                    </span>
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="font-mono text-xs min-w-(--anchor-width) w-auto">
              {DEFAULT_FACTORIO_VERSIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs py-1.5 pl-2.5 pr-8 cursor-pointer">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dependencies Popover */}
          <QueueSettingsPopover />

          {/* View Mode Switcher */}
          {targetMods.length > 0 && (
            <Tabs
              value={viewMode}
              onValueChange={(val) => setViewMode(val as "cards" | "tree")}
            >
              <TabsList className="h-8 p-0.5 bg-muted/60 text-xs gap-1 select-none font-sans">
                <TabsTrigger
                  value="cards"
                  className="text-xs h-7 w-7 p-0 cursor-pointer"

                  aria-label="Card View"
                >
                  <LayoutGrid className="size-3.5" />
                </TabsTrigger>
                <TabsTrigger
                  value="tree"
                  className="text-xs h-7 w-7 p-0 cursor-pointer"

                  aria-label="Dependency Tree View"
                >
                  <Layers className="size-3.5" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}


          {/* Download All Primary Action */}
          {targetMods.length > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={compatibleMods.length === 0 || isResolving}
              className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleStartDownloadAll}
            >
              {isResolving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>
                {isResolving
                  ? "Resolving..."
                  : `Download All (${compatibleMods.length})`}
              </span>
            </Button>
          )}

          {/* Clear Queue Button */}
          {targetMods.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-destructive cursor-pointer px-2"
              onClick={clearTargetMods}
              aria-label="Clear all mods from queue"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Error banner if resolution fails */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2 animate-in fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Body */}
      {targetMods.length === 0 ? (
        /* Empty State Card */
        <Card className="border-dashed">
          <CardHeader className="text-center py-16">
            <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-base font-semibold">
              Your mod queue is empty
            </CardTitle>
            <CardDescription className="max-w-md mx-auto text-xs text-muted-foreground mt-1">
              Add mods to inspect their dependencies, choose specific releases, and download everything in a clean batch.
            </CardDescription>

            {onNavigateToExplore && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNavigateToExplore}
                  className="gap-2 text-xs font-medium cursor-pointer"
                >
                  <span>Explore Factorio Mods</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            )}
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className={viewMode === "tree" ? "block" : "hidden"}>
            {/* Dependency Tree View */}
            <DependencyTreeView targetMods={targetMods} />
          </div>
          <div className={viewMode === "cards" ? "block" : "hidden"}>
            {/* Accordions List View */}
            <Accordion
              value={expandedCardIds}
              onValueChange={(val: any) =>
                setExpandedCardIds(Array.isArray(val) ? val : val ? [val] : [])
              }
              className="space-y-3"
            >
              {targetMods.map((mod) => (
                <ModAccordionCard
                  key={mod.id}
                  mod={mod}
                  factorioVersion={factorioVersion}
                />
              ))}
            </Accordion>
          </div>
        </>
      )}
    </div>
  )
}
