import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { AlertTriangle, Download, Loader2, CheckCircle2 } from "lucide-react"
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
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { useCollectionsStore } from "@/stores/use-collections-store"
import type { CollectionProfile, MissingModDetail } from "../types"

interface MissingModsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: CollectionProfile | null
  missingMods: MissingModDetail[]
  disableOtherMods?: boolean
  onCompleted?: () => void
}

export function MissingModsDialog({
  open,
  onOpenChange,
  profile,
  missingMods,
  disableOtherMods = true,
  onCompleted,
}: MissingModsDialogProps) {
  const applyCollection = useCollectionsStore((s) => s.applyCollection)
  const loadMods = useModManagerStore((s) => s.loadMods)
  const fetchTasks = useDownloadsStore((s) => s.fetchTasks)

  const [isProcessing, setIsProcessing] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  if (!profile) return null

  const handleDownloadAndApply = async () => {
    setIsProcessing(true)
    setErrorMsg(null)

    try {
      // 1. Prepare batch for missing mods / versions
      const mainMods = missingMods.map(({ mod: m }) => ({
        id: m.name,
        title: m.name,
        version: m.version && m.version !== "latest" ? m.version : "",
        file_name: `${m.name}_${m.version || "latest"}.zip`,
        sha1: "",
        reason: "direct",
      }))

      // 2. Fetch required dependencies for each missing mod
      const allDirectDeps: any[] = []
      const CORE_MODS = new Set(["base", "space-age", "quality", "elevated-rails", "recycler"])
      for (const { mod: m } of missingMods) {
        try {
          const details = await invoke<any>("fetch_mod_details", { modId: m.name })
          const targetVer = m.version && m.version !== "latest" ? m.version : undefined
          const matchedRelease = targetVer
            ? (details.releases || []).find((r: any) => r.version === targetVer)
            : (details.releases || [])[details.releases?.length - 1]
          const reqs = matchedRelease?.dependencies?.required || []
          for (const req of reqs) {
            const reqName = (req.id || req.name || "").toLowerCase()
            if (!CORE_MODS.has(reqName)) {
              allDirectDeps.push({
                id: req.id || req.name,
                ineq: req.ineq || ">=",
                version: req.version || "",
              })
            }
          }
        } catch (e) {
          console.warn(`Could not fetch dependencies for missing mod ${m.name}:`, e)
        }
      }

      const cleanFactorioVer =
        !profile.factorioVersion || profile.factorioVersion === "all" || profile.factorioVersion === "any"
          ? null
          : profile.factorioVersion

      const resolved = await invoke<any[]>("resolve_download_batch", {
        mainMods,
        directDeps: allDirectDeps,
        includeRecommended: false,
        factorioVersion: cleanFactorioVer,
      })

      let modsFolder = await invoke<string | null>("get_mods_folder")
      if (!modsFolder) {
        modsFolder = await invoke<string>("detect_default_mods_folder")
      }

      // Register download groups for downloader UI tracking
      const groupsToRegister = missingMods.map(({ mod: m }) => ({
        parent: m.name,
        dependencies: resolved
          .filter((item) => item.id !== m.name && item.reason === "dependency")
          .map((item) => item.id),
      }))
      useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

      // 3. Start downloads
      await invoke("start_download_batch", {
        items: resolved,
        outputDir: modsFolder,
      })

      fetchTasks()

      // 4. Apply profile configuration to mod-list.json (and switch stashed versions if applicable)
      await applyCollection(profile.id, disableOtherMods)
      await loadMods(true)

      onOpenChange(false)
      onCompleted?.()
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to download and apply mods.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApplyWithoutDownloading = async () => {
    setIsProcessing(true)
    setErrorMsg(null)
    try {
      await applyCollection(profile.id, disableOtherMods)
      await loadMods(true)
      onOpenChange(false)
      onCompleted?.()
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to apply collection.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle className="text-base font-bold text-foreground">
              Missing Mods / Versions Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            The profile <strong className="text-foreground">"{profile.name}"</strong> specifies{" "}
            <strong className="text-foreground">{missingMods.length} mod(s)</strong> with missing files or versions not found in your local Factorio mods folder.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="rounded-lg border border-border/80 bg-muted/30 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border/60 bg-muted/50 text-[11px] font-semibold text-muted-foreground flex justify-between">
              <span>Mod / Requested Version</span>
              <span>Status</span>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-border/40 p-1 [scrollbar-width:thin] [scrollbar-color:oklch(0.56_0.021_213.5/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
              {missingMods.map(({ mod: m, reason, installedVersion }) => (
                <div key={m.name} className="flex items-center justify-between px-2.5 py-2 text-xs">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium text-foreground truncate">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {reason === "not_installed" ? (
                        "Not installed locally"
                      ) : (
                        <>
                          Target: <span className="font-mono text-foreground font-semibold">v{m.version}</span>
                          {installedVersion && (
                            <> (current: <span className="font-mono">v{installedVersion}</span>)</>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] h-4.5 px-1.5 bg-amber-500/10 font-sans"
                    >
                      {reason === "not_installed" ? "Missing Mod" : "Missing Version"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        m.enabled
                          ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] h-4.5 px-1.5"
                          : "text-muted-foreground text-[10px] h-4.5 px-1.5"
                      }
                    >
                      {m.enabled ? "Will Enable" : "Will Disable"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20">
              {errorMsg}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Would you like to automatically download and install these missing mods and versions, including their required dependencies?
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isProcessing}
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isProcessing}
            onClick={handleApplyWithoutDownloading}
            className="text-xs cursor-pointer"
          >
            Apply Without Downloading
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isProcessing}
            onClick={handleDownloadAndApply}
            className="text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground"
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>{isProcessing ? "Downloading..." : "Download & Apply"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

