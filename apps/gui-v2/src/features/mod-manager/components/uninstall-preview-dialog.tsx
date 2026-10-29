import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { Trash2, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import type { UninstallPreview } from "../types"

interface UninstallPreviewDialogProps {
  targets: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function UninstallPreviewDialog({
  targets,
  open,
  onOpenChange,
  onSuccess,
}: UninstallPreviewDialogProps) {
  const loadMods = useModManagerStore((s) => s.loadMods)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)

  const [preview, setPreview] = React.useState<UninstallPreview | null>(null)
  const [deleteStashed, setDeleteStashed] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && targets.length > 0) {
      setIsLoading(true)
      setErrorMsg(null)
      invoke<UninstallPreview>("uninstall_mods_preview", { targets })
        .then((res) => {
          setPreview(res)
          setIsLoading(false)
        })
        .catch((e) => {
          setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to load uninstall preview")
          setIsLoading(false)
        })
    }
  }, [open, targets])

  const handleConfirm = async () => {
    if (!preview) return
    setIsDeleting(true)
    setErrorMsg(null)

    const allToRemove = [...preview.targets, ...preview.cascadeRemovals]
    try {
      await invoke("uninstall_mods", {
        targets: allToRemove,
        deleteStashedToo: deleteStashed,
      })
      await loadMods()
      onOpenChange(false)
      onSuccess?.()
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to uninstall mods")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            <span>Confirm Mod Uninstall</span>
          </DialogTitle>
          <DialogDescription>
            Factorio Mod Downloader checks dependencies so only mods no longer required by any installed mod are removed.
          </DialogDescription>
        </DialogHeader>

        {isFactorioRunning && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Factorio is running. Please exit the game before uninstalling mods.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          {/* Target Mods to remove */}
          <div className="space-y-1.5">
            <div className="font-semibold text-foreground flex items-center justify-between">
              <span>Selected for Removal ({targets.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 max-h-24 overflow-y-auto">
              {targets.map((name) => (
                <Badge key={name} variant="destructive">
                  {name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cascade Removals */}
          {preview && preview.cascadeRemovals.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                <span>Cascade Removals ({preview.cascadeRemovals.length})</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                These mods were installed as dependencies of the target and are no longer required by any other installed mod:
              </p>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-amber-500/20 bg-amber-500/5 max-h-24 overflow-y-auto">
                {preview.cascadeRemovals.map((name) => (
                  <Badge
                    key={name}
                    className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Kept Dependencies */}
          {preview && preview.keptDependencies.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                <span>Dependencies Preserved ({preview.keptDependencies.length})</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                These dependencies will <strong>not</strong> be removed because other installed mods still require them:
              </p>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border/80 bg-muted/20 max-h-20 overflow-y-auto">
                {preview.keptDependencies.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Stashed versions cleanup checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Checkbox
              id="delete-stashed"
              checked={deleteStashed}
              onCheckedChange={(checked) => setDeleteStashed(!!checked)}
            />
            <label
              htmlFor="delete-stashed"
              className="text-xs text-foreground cursor-pointer select-none leading-none font-medium"
            >
              Also permanently delete all inactive stashed versions from disk
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || isDeleting || isFactorioRunning}
            className="gap-2 cursor-pointer"
          >
            <Trash2 className="size-4" />
            <span>{isDeleting ? "Uninstalling..." : "Confirm Permanent Uninstall"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
