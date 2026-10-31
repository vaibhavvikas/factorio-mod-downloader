import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ModThumbnail } from "./mod-thumbnail"
import { HealthBadge } from "./health-badge"
import { ResolveDependenciesDialog } from "./resolve-dependencies-dialog"
import {
  ExternalLink,
  FolderArchive,
  User,
  Tag,
  HardDrive,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  Ban,
  ChevronDown,
  ArrowUpDown,
  Trash2,
  Loader2,
  Globe,
  AlertTriangle,
  Download,
  Filter,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { invoke } from "@tauri-apps/api/core"
import type { InstalledModGroup } from "../types"

interface ParsedDependency {
  raw: string
  name: string
  constraint?: string
  kind: "required" | "recommended" | "optional" | "incompatible"
}

function parseDependency(depStr: string): ParsedDependency {
  const trimmed = depStr.trim()
  let kind: "required" | "recommended" | "optional" | "incompatible" = "required"
  let rest = trimmed

  if (rest.startsWith("!")) {
    kind = "incompatible"
    rest = rest.slice(1).trim()
  } else if (rest.startsWith("(?)")) {
    kind = "optional"
    rest = rest.slice(3).trim()
  } else if (rest.startsWith("?")) {
    kind = "optional"
    rest = rest.slice(1).trim()
  } else if (rest.startsWith("(+)")) {
    kind = "recommended"
    rest = rest.slice(3).trim()
  } else if (rest.startsWith("+")) {
    kind = "recommended"
    rest = rest.slice(1).trim()
  } else if (rest.startsWith("~")) {
    kind = "optional"
    rest = rest.slice(1).trim()
  }

  const match = rest.match(/^([^>=<~!=]+?)(?:\s*(>=|<=|>|<|==|=)\s*(.+))?$/)
  const name = match ? match[1].trim() : rest
  const constraint = match && match[2] && match[3] ? `${match[2]} ${match[3].trim()}` : undefined

  return { raw: depStr, name, constraint, kind }
}

function DependencyRow({
  dep,
  installedMod,
}: {
  dep: ParsedDependency
  installedMod?: InstalledModGroup
}) {
  const isCore = ["base", "space-age", "quality", "elevated-rails"].includes(dep.name)

  return (
    <div className="px-4 py-2.5 font-mono text-xs flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-foreground truncate">{dep.name}</span>
        {isCore && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-sans px-1.5 py-0 h-4">
            core
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {dep.constraint && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono font-normal px-1.5 py-0 h-4">
            {dep.constraint}
          </Badge>
        )}

        {installedMod ? (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-sans px-2 py-0 h-4.5 font-medium",
              installedMod.enabled
                ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                : "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
            )}
          >
            {installedMod.enabled ? "Active" : "Disabled"}
          </Badge>
        ) : !isCore ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground/60 font-sans px-2 py-0 h-4.5">
            Not Installed
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  icon: Icon,
  iconColor,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  count: number
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden transition-colors shadow-2xs">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${title} dependencies`}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors select-none cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              !isOpen && "-rotate-90"
            )}
          />
          <Icon className={cn("size-3.5 shrink-0", iconColor)} />
          <span className="truncate">{title}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-4.5 font-mono shrink-0">
          {count}
        </Badge>
      </button>

      {isOpen && (
        <div className="divide-y divide-border/30 border-t border-border/40 bg-background/30">
          {children}
        </div>
      )}
    </div>
  )
}

interface ModDetailsPanelProps {
  mod: InstalledModGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onManageVersions?: (mod: InstalledModGroup) => void
}

export function ModDetailsPanel({
  mod,
  open,
  onOpenChange,
}: ModDetailsPanelProps) {
  const switchVersion = useModManagerStore((s) => s.switchVersion)
  const deleteVersion = useModManagerStore((s) => s.deleteVersion)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)
  const allInstalledMods = useModManagerStore((s) => s.mods)
  const factorioVersion = useSettingsStore((s) => s.factorioVersion)

  // Reactively track currently inspected mod from store so version switches update the UI in real time
  const activeMod = React.useMemo(() => {
    if (!mod) return null
    return allInstalledMods.find((m) => m.name === mod.name) || mod
  }, [allInstalledMods, mod])

  const hasFactorioTarget = Boolean(
    factorioVersion && factorioVersion !== "all" && factorioVersion !== "any"
  )

  const isFactorioIncompatible = Boolean(
    activeMod &&
    !activeMod.isVirtual &&
    hasFactorioTarget &&
    activeMod.factorioVersion &&
    !isFactorioVersionCompatible(activeMod.factorioVersion, factorioVersion!)
  )

  // Version management states
  const [isProcessingVersion, setIsProcessingVersion] = React.useState(false)
  const [downloadingVersion, setDownloadingVersion] = React.useState<string | null>(null)
  const [versionToDelete, setVersionToDelete] = React.useState<string | null>(null)
  const [pendingIncompatibleSwitch, setPendingIncompatibleSwitch] = React.useState<string | null>(null)
  const [pendingIncompatibleDownload, setPendingIncompatibleDownload] = React.useState<any | null>(null)
  const [versionError, setVersionError] = React.useState<string | null>(null)
  const [portalReleases, setPortalReleases] = React.useState<any[]>([])
  const [isLoadingPortal, setIsLoadingPortal] = React.useState(false)
  const [isPortalReleasesOpen, setIsPortalReleasesOpen] = React.useState(false)
  const [filterCompatibleOnly, setFilterCompatibleOnly] = React.useState(true)
  const [isResolveDepsOpen, setIsResolveDepsOpen] = React.useState(false)
  const loadMods = useModManagerStore((s) => s.loadMods)
  const downloadTasks = useDownloadsStore((s) => s.tasks)

  const isVersionDownloading = React.useCallback(
    (version: string) => {
      if (downloadingVersion === version) return true
      return downloadTasks.some(
        (t) =>
          t.rawId === activeMod?.name &&
          (t.version === version || !t.version) &&
          (t.statusType === "downloading" || t.statusType === "pending" || t.statusType === "paused")
      )
    },
    [downloadingVersion, downloadTasks, activeMod?.name]
  )

  const isLatestDownloading = React.useMemo(() => {
    if (!activeMod?.latestVersion) return false
    return isVersionDownloading(activeMod.latestVersion)
  }, [activeMod?.latestVersion, isVersionDownloading])

  // Fetch portal releases when mod changes
  React.useEffect(() => {
    if (!activeMod?.name) {
      setPortalReleases([])
      return
    }
    setIsLoadingPortal(true)
    invoke<any>("fetch_mod_details", { modId: activeMod.name })
      .then((res) => {
        const rels = (res.releases || []).slice().reverse()
        setPortalReleases(rels)
      })
      .catch(() => {
        setPortalReleases([])
      })
      .finally(() => {
        setIsLoadingPortal(false)
      })
  }, [activeMod?.name])

  const getVersionFactorioVer = React.useCallback(
    (ver: string): string | undefined => {
      if (activeMod?.activeVersion === ver && activeMod.factorioVersion) {
        return activeMod.factorioVersion
      }
      const rel = portalReleases.find((r: any) => r.version === ver)
      return rel?.info_json?.factorio_version || rel?.factorio_version
    },
    [activeMod, portalReleases]
  )

  const filteredPortalReleases = React.useMemo(() => {
    if (!filterCompatibleOnly || !hasFactorioTarget) {
      return portalReleases
    }
    return portalReleases.filter((rel: any) => {
      const relFactorioVer = rel.info_json?.factorio_version || rel.factorio_version
      if (!relFactorioVer) return true
      return isFactorioVersionCompatible(relFactorioVer, factorioVersion!)
    })
  }, [portalReleases, filterCompatibleOnly, hasFactorioTarget, factorioVersion])

  const handleSwitchVersion = async (ver: string) => {
    if (!activeMod) return
    setVersionError(null)
    setIsProcessingVersion(true)
    try {
      await switchVersion(activeMod.name, ver)
    } catch (e: any) {
      setVersionError(typeof e === "string" ? e : e?.message || "Failed to switch version")
    } finally {
      setIsProcessingVersion(false)
    }
  }

  const triggerSwitchVersion = (ver: string) => {
    const relFactorioVer = getVersionFactorioVer(ver)
    const isIncompatible = Boolean(
      hasFactorioTarget &&
      relFactorioVer &&
      !isFactorioVersionCompatible(relFactorioVer, factorioVersion!)
    )

    if (isIncompatible) {
      setPendingIncompatibleSwitch(ver)
    } else {
      handleSwitchVersion(ver)
    }
  }

  const handleConfirmDeleteVersion = async () => {
    if (!versionToDelete || !activeMod) return
    setVersionError(null)
    setIsProcessingVersion(true)
    try {
      await deleteVersion(activeMod.name, versionToDelete)
      setVersionToDelete(null)
    } catch (e: any) {
      setVersionError(typeof e === "string" ? e : e?.message || "Failed to delete version")
    } finally {
      setIsProcessingVersion(false)
    }
  }

  const triggerDownloadRelease = (rel: any) => {
    const relFactorioVer = rel.info_json?.factorio_version || rel.factorio_version
    const isIncompatible = Boolean(
      hasFactorioTarget &&
      relFactorioVer &&
      !isFactorioVersionCompatible(relFactorioVer, factorioVersion!)
    )

    if (isIncompatible) {
      setPendingIncompatibleDownload(rel)
    } else {
      executeDownloadRelease(rel)
    }
  }

  const executeDownloadRelease = async (rel: any) => {
    if (!activeMod) return
    setVersionError(null)
    setDownloadingVersion(rel.version)
    try {
      let targetModsFolder = await invoke<string | null>("get_mods_folder")
      if (!targetModsFolder) {
        targetModsFolder = await invoke<string>("detect_default_mods_folder")
      }

      const mainMods = [
        {
          id: activeMod.name,
          title: activeMod.title,
          version: rel.version,
          file_name: rel.file_name || `${activeMod.name}_${rel.version}.zip`,
          sha1: rel.sha1 || "",
          reason: "direct",
        },
      ]

      let reqDeps = rel.dependencies?.required || []
      if (!rel.dependencies && activeMod.name) {
        try {
          const details = await invoke<any>("fetch_mod_details", { modId: activeMod.name })
          const matchedRelease = (details.releases || []).find((r: any) => r.version === rel.version)
          if (matchedRelease?.dependencies?.required) {
            reqDeps = matchedRelease.dependencies.required
          }
        } catch (e) {
          console.warn("Could not fetch release dependencies:", e)
        }
      }

      const CORE_MODS = new Set(["base", "space-age", "quality", "elevated-rails", "recycler"])
      const directDeps = reqDeps
        .filter((d: any) => !CORE_MODS.has((d.id || d.name || "").toLowerCase()))
        .map((d: any) => ({
          id: d.id || d.name,
          ineq: d.ineq || ">=",
          version: d.version || "",
        }))

      const cleanFactorioVer =
        !factorioVersion || factorioVersion === "all" || factorioVersion === "any"
          ? null
          : factorioVersion

      const resolvedBatch = await invoke<any[]>("resolve_download_batch", {
        mainMods,
        directDeps,
        includeRecommended: false,
        factorioVersion: cleanFactorioVer,
      })

      const groupsToRegister = [
        {
          parent: activeMod.name,
          dependencies: resolvedBatch
            .filter((item) => item.id !== activeMod.name)
            .map((item) => item.id),
        },
      ]
      useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

      await invoke("start_download_batch", {
        items: resolvedBatch,
        outputDir: targetModsFolder,
      })

      useDownloadsStore.getState().fetchTasks()
      const depCount = resolvedBatch.length - 1
      toast.add({
        type: "success",
        title: "Download Started",
        description:
          depCount > 0
            ? `Downloading ${activeMod.title} v${rel.version} and ${depCount} required ${depCount === 1 ? "dependency" : "dependencies"}`
            : `Downloading ${activeMod.title} v${rel.version}`,
      })
      await loadMods()
    } catch (e: any) {
      const err = typeof e === "string" ? e : e?.message || "Failed to download version"
      setVersionError(err)
      toast.add({
        type: "error",
        title: "Download Failed",
        description: err,
        priority: "high",
      })
    } finally {
      setDownloadingVersion(null)
    }
  }

  // By default keep all collapsed except "required" dependencies; if no required, all stay collapsed
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    required: true,
    recommended: false,
    optional: false,
    incompatible: false,
  })

  // Reset state whenever switching to a different mod
  React.useEffect(() => {
    setOpenSections({
      required: true,
      recommended: false,
      optional: false,
      incompatible: false,
    })
    setVersionError(null)
  }, [activeMod?.name])

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const installedMap = React.useMemo(() => {
    const map = new Map<string, InstalledModGroup>()
    for (const m of allInstalledMods) {
      map.set(m.name, m)
    }
    return map
  }, [allInstalledMods])

  const parsedDeps = React.useMemo(() => {
    if (!activeMod) return []
    return (activeMod.dependencies || []).map(parseDependency)
  }, [activeMod?.dependencies])

  const requiredDeps = React.useMemo(() => parsedDeps.filter((d) => d.kind === "required"), [parsedDeps])
  const recommendedDeps = React.useMemo(() => parsedDeps.filter((d) => d.kind === "recommended"), [parsedDeps])
  const optionalDeps = React.useMemo(() => parsedDeps.filter((d) => d.kind === "optional"), [parsedDeps])
  const incompatibleDeps = React.useMemo(() => parsedDeps.filter((d) => d.kind === "incompatible"), [parsedDeps])

  if (!activeMod) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l border-border/80 shadow-2xl">
        <SheetHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/15">
          <div className="flex items-center gap-3.5">
            <ModThumbnail
              name={activeMod.name}
              title={activeMod.title}
              thumbnail={activeMod.thumbnail}
              isVirtual={activeMod.isVirtual}
              category={activeMod.category}
              className="size-14 rounded-lg border border-border/70 shadow-xs shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="pr-6">
                <SheetTitle className="text-base font-bold truncate leading-tight text-foreground">
                  {activeMod.title}
                </SheetTitle>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate leading-none">
                <span className="font-mono text-[11px]">{activeMod.name}</span>
                {activeMod.author && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="truncate">by {activeMod.author}</span>
                  </>
                )}
                {activeMod.category && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal capitalize">
                    {activeMod.category}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {activeMod.activeVersion ? (
                  <Badge variant="outline" className="font-mono text-[11px] h-5 px-1.5 font-semibold">
                    v{activeMod.activeVersion}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer font-sans"
                  aria-label="View on Factorio Mod Portal"
                  onClick={() => {
                    import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
                      openUrl(`https://mods.factorio.com/mod/${activeMod.name}`)
                    })
                  }}
                >
                  <ExternalLink className="size-3" />
                  <span>Portal</span>
                </Button>
                {isFactorioIncompatible && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-2 font-medium text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 shrink-0 gap-1"
                    aria-label={`Incompatible with Factorio ${factorioVersion}`}
                  >
                    <AlertTriangle className="size-2.5 text-amber-600 dark:text-amber-400" />
                    <span>Incompatible with Factorio {factorioVersion}</span>
                  </Badge>
                )}
                {activeMod.hasUpdate && activeMod.latestVersion && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 px-2 text-[10px] gap-1 font-sans cursor-pointer bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 shrink-0"
                    disabled={isLatestDownloading || isFactorioRunning}
                    onClick={() => {
                      const matchedRel = portalReleases.find((r) => r.version === activeMod.latestVersion)
                      triggerDownloadRelease(
                        matchedRel || {
                          version: activeMod.latestVersion,
                          file_name: `${activeMod.name}_${activeMod.latestVersion}.zip`,
                        }
                      )
                    }}
                    aria-label={`Update ${activeMod.title} to v${activeMod.latestVersion}`}
                  >
                    {isLatestDownloading ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <Download className="size-2.5 text-blue-600 dark:text-blue-400" />
                    )}
                    <span>{isLatestDownloading ? "Downloading..." : `Update v${activeMod.latestVersion}`}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-5 space-y-4 text-xs">
            {/* Factorio version incompatibility alert */}
            {isFactorioIncompatible && (
              <Alert variant="warning" className="rounded-xl">
                <AlertTriangle className="size-4" />
                <AlertTitle>Factorio Version Incompatibility</AlertTitle>
                <AlertDescription className="text-[11px] text-muted-foreground">
                  Active mod requires Factorio <span className="font-mono font-medium text-foreground">{activeMod.factorioVersion || "unknown"}</span>, but current target is <span className="font-mono font-medium text-foreground">Factorio {factorioVersion}</span>.
                </AlertDescription>
              </Alert>
            )}

            {/* Health alert if any */}
            {activeMod.healthIssues.length > 0 && (
              <Alert variant="warning" className="rounded-xl">
                <AlertTriangle className="size-4" />
                <AlertTitle className="flex items-center gap-2">
                  <span>Issues Detected</span>
                  <HealthBadge
                    issues={activeMod.healthIssues}
                    onClick={() => setIsResolveDepsOpen(true)}
                  />
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground mt-1">
                    {activeMod.healthIssues.map((issue, idx) => (
                      <li key={idx}>{issue.message}</li>
                    ))}
                  </ul>
                  {activeMod.healthIssues.some(
                    (i) => i.kind === "missing_dep" || i.kind === "disabled_dep" || i.kind === "not_installed"
                  ) && (
                    <div className="pt-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1 px-2 font-sans cursor-pointer text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/15"
                        onClick={() => setIsResolveDepsOpen(true)}
                        aria-label="Resolve missing or disabled dependencies"
                      >
                        <Layers className="size-3" />
                        <span>Resolve Dependencies...</span>
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Versions & Files (First Section) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderArchive className="size-4 text-primary" />
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                    Installed Versions
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px] h-4.5 px-1.5">
                    {(activeMod.activeVersion ? 1 : 0) + activeMod.stashedVersions.length}
                  </Badge>
                </div>
              </div>

              {isFactorioRunning && (
                <Alert variant="warning" className="rounded-xl">
                  <AlertTriangle className="size-4" />
                  <AlertDescription className="text-xs">
                    Factorio is running. Close the game to switch or delete versions.
                  </AlertDescription>
                </Alert>
              )}

              {versionError && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertTriangle className="size-4" />
                  <AlertDescription className="text-xs">{versionError}</AlertDescription>
                </Alert>
              )}

              {/* Active Version Card */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 shadow-2xs flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active In Game
                </span>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {activeMod.activeVersion ? `v${activeMod.activeVersion}` : "None (Inactive)"}
                </span>
              </div>

              {/* Stashed / Inactive Versions List */}
              {activeMod.stashedVersions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-medium text-muted-foreground block">
                    Other Local Versions ({activeMod.stashedVersions.length})
                  </span>
                  <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/30 bg-card/40 shadow-2xs">
                    {activeMod.stashedVersions.map((ver) => {
                      const stFactorioVer = getVersionFactorioVer(ver.version)
                      const isStIncompatible = Boolean(
                        hasFactorioTarget &&
                        stFactorioVer &&
                        !isFactorioVersionCompatible(stFactorioVer, factorioVersion!)
                      )

                      return (
                        <div
                          key={ver.version}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/25 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              v{ver.version}
                            </span>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground h-4 px-1.5 font-normal">
                              Inactive
                            </Badge>
                            {isStIncompatible && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 bg-destructive/10 h-4 px-1.5 font-sans font-medium">
                                Incompatible{stFactorioVer ? ` (Factorio ${stFactorioVer})` : ""}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "h-7 text-xs gap-1.5 px-2.5 cursor-pointer font-sans",
                                isStIncompatible && "text-destructive border-destructive/40 hover:bg-destructive/10"
                              )}
                              disabled={isProcessingVersion || isFactorioRunning}
                              onClick={() => triggerSwitchVersion(ver.version)}
                              aria-label={`Activate version ${ver.version}`}
                            >
                              <ArrowUpDown className="size-3" />
                              <span>Activate</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                              disabled={isProcessingVersion || isFactorioRunning}
                              onClick={() => setVersionToDelete(ver.version)}
                              aria-label={`Delete version ${ver.version}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Portal Releases Section */}
              <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsPortalReleasesOpen((prev) => !prev)}
                  aria-expanded={isPortalReleasesOpen}
                  aria-label="Toggle Portal releases"
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors select-none cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
                        !isPortalReleasesOpen && "-rotate-90"
                      )}
                    />
                    <Globe className="size-4 text-blue-500 shrink-0" />
                    <span className="truncate">All Portal Releases</span>
                  </div>
                  {isLoadingPortal ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-4.5 font-mono shrink-0">
                      {filteredPortalReleases.length !== portalReleases.length
                        ? `${filteredPortalReleases.length} / ${portalReleases.length}`
                        : portalReleases.length}
                    </Badge>
                  )}
                </button>

                {isPortalReleasesOpen && (
                  <>
                    {hasFactorioTarget && (
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border/40 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Filter className="size-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium">Compatible with Factorio {factorioVersion} only</span>
                        </div>
                        <Switch
                          size="sm"
                          checked={filterCompatibleOnly}
                          onCheckedChange={setFilterCompatibleOnly}
                          aria-label={`Filter releases compatible with Factorio ${factorioVersion}`}
                        />
                      </div>
                    )}

                    <ScrollArea
                      className="h-80 border-t border-border/40 bg-background/30"
                      viewportClassName="overscroll-contain"
                    >
                      {filteredPortalReleases.length === 0 ? (
                        <div className="p-6 text-center space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {isLoadingPortal
                              ? "Fetching releases from Mod Portal..."
                              : filterCompatibleOnly && hasFactorioTarget && portalReleases.length > 0
                              ? `No releases found compatible with Factorio ${factorioVersion} (${portalReleases.length} other releases available).`
                              : "No releases found on Mod Portal."}
                          </p>
                          {filterCompatibleOnly && hasFactorioTarget && portalReleases.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs cursor-pointer"
                              onClick={() => setFilterCompatibleOnly(false)}
                              aria-label="Show all releases including incompatible versions"
                            >
                              Show all {portalReleases.length} releases
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {filteredPortalReleases.map((rel: any) => {
                            const isCurrentActive = rel.version === activeMod.activeVersion
                            const isStashed = activeMod.stashedVersions.some((s) => s.version === rel.version)
                            const factorioVer = rel.info_json?.factorio_version || rel.factorio_version
                            const isIncompatible = Boolean(
                              hasFactorioTarget &&
                              factorioVer &&
                              !isFactorioVersionCompatible(factorioVer, factorioVersion!)
                            )

                            return (
                              <div
                                key={rel.version}
                                className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/25 transition-colors text-xs"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-semibold text-foreground">
                                      v{rel.version}
                                    </span>
                                    {factorioVer && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] h-4 px-1.5 font-mono",
                                          isIncompatible
                                            ? "text-destructive border-destructive/40 bg-destructive/10 font-semibold"
                                            : "text-muted-foreground"
                                        )}
                                      >
                                        Factorio {factorioVer}
                                      </Badge>
                                    )}
                                  </div>
                                  {rel.released_at && (
                                    <p className="text-[10px] text-muted-foreground font-sans">
                                      Released {new Date(rel.released_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isCurrentActive ? (
                                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 text-[10px] h-5 px-2 font-sans font-medium">
                                      Active
                                    </Badge>
                                  ) : isStashed ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-6 text-[11px] gap-1 px-2.5 cursor-pointer font-sans",
                                        isIncompatible && "text-destructive border-destructive/40 hover:bg-destructive/10"
                                      )}
                                      disabled={isProcessingVersion || isFactorioRunning}
                                      onClick={() => triggerSwitchVersion(rel.version)}
                                      aria-label={`Activate version ${rel.version}`}
                                    >
                                      <ArrowUpDown className="size-3" />
                                      <span>Activate</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-6 text-[11px] gap-1 px-2.5 cursor-pointer font-sans",
                                        isIncompatible
                                          ? "text-destructive border-destructive/40 hover:bg-destructive/10"
                                          : "text-primary hover:text-primary hover:bg-primary/10"
                                      )}
                                      disabled={isVersionDownloading(rel.version) || isFactorioRunning}
                                      onClick={() => triggerDownloadRelease(rel)}
                                      aria-label={`Download version ${rel.version}`}
                                    >
                                      {isVersionDownloading(rel.version) ? (
                                        <>
                                          <Loader2 className="size-3 animate-spin" />
                                          <span>Downloading...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Download className="size-3" />
                                          <span>Download</span>
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                )}
              </div>
            </div>

            {/* Dependencies (Second Section) */}
            <div className="space-y-3 pt-3.5 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                  Dependencies ({parsedDeps.length})
                </h4>
                {parsedDeps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const anyOpen = Object.values(openSections).some(Boolean)
                      if (anyOpen) {
                        setOpenSections({
                          required: false,
                          recommended: false,
                          optional: false,
                          incompatible: false,
                        })
                      } else {
                        setOpenSections({
                          required: true,
                          recommended: true,
                          optional: true,
                          incompatible: true,
                        })
                      }
                    }}
                    aria-label="Toggle expand or collapse all dependency sections"
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {Object.values(openSections).some(Boolean) ? "Collapse all" : "Expand all"}
                  </button>
                )}
              </div>

              {parsedDeps.length === 0 ? (
                <p className="text-muted-foreground italic text-xs">No dependencies declared.</p>
              ) : (
                <div className="space-y-2.5">
                  {/* Required Dependencies */}
                  {requiredDeps.length > 0 && (
                    <CollapsibleSection
                      title="Required"
                      icon={CheckCircle2}
                      iconColor="text-emerald-500"
                      count={requiredDeps.length}
                      isOpen={!!openSections["required"]}
                      onToggle={() => toggleSection("required")}
                    >
                      {requiredDeps.map((dep, idx) => (
                        <DependencyRow key={idx} dep={dep} installedMod={installedMap.get(dep.name)} />
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* Recommended Dependencies */}
                  {recommendedDeps.length > 0 && (
                    <CollapsibleSection
                      title="Recommended"
                      icon={ThumbsUp}
                      iconColor="text-amber-500"
                      count={recommendedDeps.length}
                      isOpen={!!openSections["recommended"]}
                      onToggle={() => toggleSection("recommended")}
                    >
                      {recommendedDeps.map((dep, idx) => (
                        <DependencyRow key={idx} dep={dep} installedMod={installedMap.get(dep.name)} />
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* Optional Dependencies */}
                  {optionalDeps.length > 0 && (
                    <CollapsibleSection
                      title="Optional"
                      icon={Sparkles}
                      iconColor="text-blue-500"
                      count={optionalDeps.length}
                      isOpen={!!openSections["optional"]}
                      onToggle={() => toggleSection("optional")}
                    >
                      {optionalDeps.map((dep, idx) => (
                        <DependencyRow key={idx} dep={dep} installedMod={installedMap.get(dep.name)} />
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* Incompatible */}
                  {incompatibleDeps.length > 0 && (
                    <CollapsibleSection
                      title="Incompatible"
                      icon={Ban}
                      iconColor="text-destructive"
                      count={incompatibleDeps.length}
                      isOpen={!!openSections["incompatible"]}
                      onToggle={() => toggleSection("incompatible")}
                    >
                      {incompatibleDeps.map((dep, idx) => (
                        <DependencyRow key={idx} dep={dep} installedMod={installedMap.get(dep.name)} />
                      ))}
                    </CollapsibleSection>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!versionToDelete}
        onOpenChange={(open) => !open && setVersionToDelete(null)}
        title="Delete Version"
        description={`Are you sure you want to delete version ${versionToDelete} of "${activeMod.title}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDeleteVersion}
        isProcessing={isProcessingVersion}
      />

      {/* Incompatible Switch Confirmation Dialog */}
      <ConfirmDialog
        open={!!pendingIncompatibleSwitch}
        onOpenChange={(open) => !open && setPendingIncompatibleSwitch(null)}
        title="Switch to Incompatible Version?"
        description={
          <div className="space-y-2 text-xs">
            <p>
              Version <span className="font-mono font-semibold text-foreground">v{pendingIncompatibleSwitch}</span> is designed for Factorio{" "}
              <span className="font-mono font-semibold text-foreground">
                {pendingIncompatibleSwitch ? getVersionFactorioVer(pendingIncompatibleSwitch) || "unknown" : ""}
              </span>
              , which is not compatible with current target Factorio{" "}
              <span className="font-mono font-semibold text-foreground">{factorioVersion}</span>.
            </p>
            <p className="text-muted-foreground">
              Switching to this version may cause Factorio to disable this mod or show loading errors.
            </p>
          </div>
        }
        confirmText="Switch Anyway"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (pendingIncompatibleSwitch) {
            const ver = pendingIncompatibleSwitch
            setPendingIncompatibleSwitch(null)
            await handleSwitchVersion(ver)
          }
        }}
        isProcessing={isProcessingVersion}
      />

      {/* Incompatible Download Confirmation Dialog */}
      <ConfirmDialog
        open={!!pendingIncompatibleDownload}
        onOpenChange={(open) => !open && setPendingIncompatibleDownload(null)}
        title="Download Incompatible Version?"
        description={
          <div className="space-y-2 text-xs">
            <p>
              Version <span className="font-mono font-semibold text-foreground">v{pendingIncompatibleDownload?.version}</span> requires Factorio{" "}
              <span className="font-mono font-semibold text-foreground">
                {pendingIncompatibleDownload?.info_json?.factorio_version || pendingIncompatibleDownload?.factorio_version || "unknown"}
              </span>
              , which is not compatible with current target Factorio{" "}
              <span className="font-mono font-semibold text-foreground">{factorioVersion}</span>.
            </p>
            <p className="text-muted-foreground">
              Downloading this version might not work in your current game.
            </p>
          </div>
        }
        confirmText="Download Anyway"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (pendingIncompatibleDownload) {
            const rel = pendingIncompatibleDownload
            setPendingIncompatibleDownload(null)
            await executeDownloadRelease(rel)
          }
        }}
        isProcessing={downloadingVersion === pendingIncompatibleDownload?.version}
      />

      {/* Resolve Dependencies Dialog */}
      <ResolveDependenciesDialog
        open={isResolveDepsOpen}
        onOpenChange={setIsResolveDepsOpen}
        mod={activeMod}
        allMods={allInstalledMods}
        factorioVersion={factorioVersion}
      />
    </Sheet>
  )
}
