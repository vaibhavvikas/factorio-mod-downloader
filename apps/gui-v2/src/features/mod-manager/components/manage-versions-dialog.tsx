import * as React from "react"
import { Check, Trash2, ArrowUpDown, FolderArchive, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import type { InstalledModGroup } from "../types"

interface ManageVersionsDialogProps {
  mod: InstalledModGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageVersionsDialog({
  mod,
  open,
  onOpenChange,
}: ManageVersionsDialogProps) {
  const switchVersion = useModManagerStore((s) => s.switchVersion)
  const deleteVersion = useModManagerStore((s) => s.deleteVersion)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [versionToDelete, setVersionToDelete] = React.useState<string | null>(null)

  if (!mod) return null

  const handleSwitch = async (ver: string) => {
    setErrorMsg(null)
    setIsProcessing(true)
    try {
      await switchVersion(mod.name, ver)
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to switch version")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = (ver: string) => {
    setVersionToDelete(ver)
  }

  const handleConfirmDelete = async () => {
    if (!versionToDelete || !mod) return
    setErrorMsg(null)
    setIsProcessing(true)
    try {
      await deleteVersion(mod.name, versionToDelete)
      setVersionToDelete(null)
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to delete stashed version")
    } finally {
      setIsProcessing(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="size-5 text-primary" />
            <span>Manage Versions — {mod.title}</span>
          </DialogTitle>
          <DialogDescription>
            Active mods live in your mods folder root. Inactive versions are stashed under{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">.factorio-mod-downloader/versions/</code>.
          </DialogDescription>
        </DialogHeader>

        {isFactorioRunning && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Factorio is currently running. Close the game to safely switch or delete versions.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Active Version Item */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground tracking-wider">
              Active Version (In Game)
            </div>
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {mod.activeVersion ? `v${mod.activeVersion}` : "None (Inactive)"}
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">
                    Active
                  </Badge>
                </div>
                {mod.activeFilePath && (
                  <p className="text-[11px] text-muted-foreground font-mono truncate" aria-label={mod.activeFilePath}>
                    {mod.activeFilePath}
                  </p>
                )}
              </div>
              <Check className="size-4 text-primary shrink-0" />
            </div>
          </div>

          {/* Stashed Versions */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground tracking-wider">
              Stashed Versions ({mod.stashedVersions.length})
            </div>

            {mod.stashedVersions.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                No extra stashed versions on disk for this mod.
              </div>
            ) : (
              <ScrollArea className="max-h-56 pr-2">
                <div className="space-y-2">
                  {mod.stashedVersions.map((ver) => (
                    <div
                      key={ver.version}
                      className="p-2.5 rounded-lg border border-border/70 hover:border-border flex items-center justify-between gap-3 bg-card/60"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            v{ver.version}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatSize(ver.sizeBytes)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate" aria-label={ver.filePath}>
                          {ver.filePath}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 cursor-pointer"
                          disabled={isProcessing || isFactorioRunning}
                          onClick={() => handleSwitch(ver.version)}
                        >
                          <ArrowUpDown className="size-3" />
                          <span>Activate</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                          disabled={isProcessing || isFactorioRunning}
                          onClick={() => handleDelete(ver.version)}
                          aria-label="Permanently Delete Stashed Version"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!versionToDelete}
        onOpenChange={(open) => !open && setVersionToDelete(null)}
        title="Delete Version"
        description={`Are you sure you want to delete version ${versionToDelete} of "${mod.title}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isProcessing={isProcessing}
      />
    </Dialog>
  )
}
