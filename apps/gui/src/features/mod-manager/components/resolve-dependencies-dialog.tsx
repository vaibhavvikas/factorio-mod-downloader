import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { parseDependencyString } from "../grouping"
import type { InstalledModGroup, ModGroupGraph } from "../types"
import {
  AlertTriangle,
  Download,
  CheckCircle2,
  Loader2,
  Layers,
  ArrowRight,
  Power,
} from "lucide-react"

interface ResolveDependenciesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mod: InstalledModGroup | null
  group?: ModGroupGraph | null
  allMods: InstalledModGroup[]
  factorioVersion?: string | null
}

interface ActionableDep {
  name: string
  title: string
  type: "disabled" | "missing"
  currentVersion?: string
  constraint?: string
}

export function ResolveDependenciesDialog({
  open,
  onOpenChange,
  mod,
  group,
  allMods,
  factorioVersion,
}: ResolveDependenciesDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false)
  const loadMods = useModManagerStore((s) => s.loadMods)

  const modMap = React.useMemo(() => {
    return new Map<string, InstalledModGroup>(allMods.map((m) => [m.name.toLowerCase(), m]))
  }, [allMods])

  // Aggregate all actionable dependencies (missing or disabled)
  const actionableDeps = React.useMemo(() => {
    if (!mod) return []

    const items: ActionableDep[] = []
    const seen = new Set<string>()

    // 1. If group graph children exist, inspect them first
    if (group && group.children) {
      for (const child of group.children) {
        const lower = child.name.toLowerCase()
        if (seen.has(lower)) continue

        if (child.missing) {
          seen.add(lower)
          items.push({
            name: child.name,
            title: child.title || child.name,
            type: "missing",
            constraint: child.constraint,
          })
        } else if (!child.enabled) {
          seen.add(lower)
          items.push({
            name: child.name,
            title: child.title || child.name,
            type: "disabled",
            currentVersion: child.activeVersion,
          })
        }
      }
    }

    // 2. Parse direct dependencies from mod.dependencies
    if (Array.isArray(mod.dependencies)) {
      for (const depStr of mod.dependencies) {
        const parsed = parseDependencyString(depStr)
        if (!parsed || parsed.type !== "required") continue

        const lower = parsed.id.toLowerCase()
        if (seen.has(lower)) continue

        const constraintMatch = depStr.match(/(?:=>|==|=|<=|>=|<|>)\s*(?:\d+(?:\.\d+)*)/)
        const constraint = constraintMatch ? constraintMatch[0] : undefined

        const local = modMap.get(lower)
        if (!local) {
          seen.add(lower)
          items.push({
            name: parsed.id,
            title: parsed.id,
            type: "missing",
            constraint,
          })
        } else if (!local.enabled) {
          seen.add(lower)
          items.push({
            name: local.name,
            title: local.title || local.name,
            type: "disabled",
            currentVersion: local.activeVersion,
          })
        }
      }
    }

    // 3. Check health issues for any missing/disabled dependencies not captured yet
    const allHealth = [...(mod.healthIssues || []), ...(group?.health || [])]
    for (const h of allHealth) {
      if (h.kind === "missing_dep" || h.kind === "not_installed") {
        const match = h.message.match(/dependency[:\s]+'?([a-zA-Z0-9_-]+)'?/i)
        const name = match ? match[1] : null
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase())
          items.push({
            name,
            title: name,
            type: "missing",
          })
        }
      } else if (h.kind === "disabled_dep") {
        const match = h.message.match(/dependency\s+'?([a-zA-Z0-9_-]+)'?\s+is\s+disabled/i)
        const name = match ? match[1] : null
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase())
          const local = modMap.get(name.toLowerCase())
          items.push({
            name,
            title: local?.title || name,
            type: "disabled",
            currentVersion: local?.activeVersion,
          })
        }
      }
    }

    return items
  }, [mod, group, modMap])

  const disabledCount = actionableDeps.filter((d) => d.type === "disabled").length
  const missingCount = actionableDeps.filter((d) => d.type === "missing").length
  const parentWillBeEnabled = Boolean(mod && !mod.enabled)

  const handleResolve = async () => {
    if (!mod) return
    setIsProcessing(true)

    try {
      // 1. Enable disabled dependencies and parent mod
      const toEnable: [string, boolean][] = actionableDeps
        .filter((d) => d.type === "disabled")
        .map((d) => [d.name, true])

      if (parentWillBeEnabled) {
        toEnable.push([mod.name, true])
      }

      if (toEnable.length > 0) {
        await invoke("set_mods_enabled_batch", { updates: toEnable })
      }

      // 2. Download missing dependencies if any
      const missingDeps = actionableDeps.filter((d) => d.type === "missing")
      if (missingDeps.length > 0) {
        const directDeps = missingDeps.map((m) => {
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

        const cleanFactorioVer =
          !factorioVersion || factorioVersion === "all" || factorioVersion === "any"
            ? null
            : factorioVersion

        const resolved = await invoke<any[]>("resolve_download_batch", {
          mainMods: [],
          directDeps,
          includeRecommended: false,
          factorioVersion: cleanFactorioVer,
        })

        let targetModsFolder = await invoke<string | null>("get_mods_folder")
        if (!targetModsFolder) {
          targetModsFolder = await invoke<string>("detect_default_mods_folder")
        }

        // Register download group so upon completion it auto-enables
        const groupsToRegister = [
          {
            parent: mod.name,
            dependencies: resolved.map((item) => item.id),
          },
        ]
        useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

        await invoke("start_download_batch", {
          items: resolved,
          outputDir: targetModsFolder,
        })

        useDownloadsStore.getState().fetchTasks()
      }

      await loadMods()

      toast.add({
        type: "success",
        title: "Dependencies Resolved",
        description:
          missingDeps.length > 0
            ? `Enabling local dependencies and started downloading ${missingDeps.length} missing mod package(s).`
            : `Enabled all required dependencies for "${mod.title}".`,
      })

      onOpenChange(false)
    } catch (e: any) {
      console.error("Failed to resolve dependencies:", e)
      const err = typeof e === "string" ? e : e?.message || "Failed to resolve dependencies."
      toast.add({
        type: "error",
        title: "Dependency Resolution Failed",
        description: err,
        priority: "high",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!mod) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Layers className="size-5 shrink-0" />
            <DialogTitle className="text-base font-bold text-foreground">
              Resolve Required Dependencies
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            The mod <strong className="text-foreground">"{mod.title}"</strong> has required
            dependencies that are currently missing or disabled. Resolving will configure and
            download all needed packages so the mod can run properly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="rounded-lg border border-border/80 bg-muted/20 overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground flex justify-between">
              <span>Required Dependency</span>
              <span>Action Planned</span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-border/40 p-1 [scrollbar-width:thin] [scrollbar-color:oklch(0.56_0.021_213.5/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
              {actionableDeps.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No missing or disabled dependencies detected.
                </div>
              ) : (
                actionableDeps.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-2.5 py-2 text-xs"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-foreground truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {item.name}
                        {item.currentVersion && ` · installed v${item.currentVersion}`}
                        {item.constraint && ` · requires ${item.constraint}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.type === "disabled" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] h-5 px-1.5 gap-1 font-sans"
                        >
                          <Power className="size-2.5" />
                          <span>Will Enable</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-[10px] h-5 px-1.5 gap-1 font-sans"
                        >
                          <Download className="size-2.5" />
                          <span>Will Download & Enable</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Show notice if parent mod itself is disabled */}
              {parentWillBeEnabled && (
                <div className="flex items-center justify-between px-2.5 py-2 text-xs bg-muted/30">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-semibold text-foreground truncate">
                      {mod.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-sans">
                      Parent mod
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] h-5 px-1.5 gap-1 font-sans shrink-0"
                  >
                    <CheckCircle2 className="size-2.5" />
                    <span>Will Activate</span>
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Helpful summary footer banner */}
          <div className="p-2.5 rounded-lg border border-border/60 bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5 text-foreground font-medium">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              <span>
                {missingCount > 0
                  ? `${missingCount} mod(s) to download · ${disabledCount} mod(s) to enable`
                  : `${disabledCount} local mod(s) to enable`}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Once completed, Factorio will be able to load <strong className="text-foreground">{mod.title}</strong> without dependency load errors.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs cursor-pointer font-sans"
            disabled={isProcessing}
            onClick={() => onOpenChange(false)}
            aria-label="Cancel dependency resolution"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-8 text-xs gap-1.5 cursor-pointer font-sans"
            disabled={isProcessing || actionableDeps.length === 0}
            onClick={handleResolve}
            aria-label={
              missingCount > 0
                ? "Download and enable dependencies"
                : "Enable all dependencies"
            }
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Resolving...</span>
              </>
            ) : missingCount > 0 ? (
              <>
                <Download className="size-3.5" />
                <span>Download & Enable</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                <span>Enable Dependencies</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

