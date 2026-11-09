import * as React from "react"
import { Download, FileText, Loader2, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useCollectionsStore } from "@/stores/use-collections-store"
import type { CollectionProfile } from "../types"

interface CollectionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (profile: CollectionProfile) => void
}

export function CollectionImportDialog({
  open,
  onOpenChange,
  onImported,
}: CollectionImportDialogProps) {
  const importCollectionDialog = useCollectionsStore((s) => s.importCollectionDialog)
  const importCollectionFromJson = useCollectionsStore((s) => s.importCollectionFromJson)

  const [jsonText, setJsonText] = React.useState("")
  const [isImporting, setIsImporting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handlePickFile = async () => {
    setErrorMsg(null)
    setIsImporting(true)
    try {
      const imported = await importCollectionDialog()
      if (imported) {
        onOpenChange(false)
        onImported?.(imported)
      }
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Failed to import from file.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportText = async () => {
    if (!jsonText.trim()) {
      setErrorMsg("Please paste valid collection JSON.")
      return
    }

    setErrorMsg(null)
    setIsImporting(true)
    try {
      const imported = await importCollectionFromJson(jsonText.trim())
      setJsonText("")
      onOpenChange(false)
      onImported?.(imported)
    } catch (e: any) {
      setErrorMsg(typeof e === "string" ? e : e?.message || "Invalid JSON or profile format.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Download className="size-5 text-primary shrink-0" />
            <DialogTitle className="text-base font-bold text-foreground">
              Import Collection Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Import a previously exported collection profile JSON file or paste exported profile text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Option 1: File Dialog */}
          <div className="rounded-lg border border-border/80 p-3 bg-card flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">Import from JSON File</span>
              <p className="text-[11px] text-muted-foreground">Pick a .json collection profile from disk</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isImporting}
              onClick={handlePickFile}
              className="text-xs gap-1.5 cursor-pointer shrink-0"
              aria-label="Select collection file"
            >
              <Download className="size-3.5" />
              <span>Choose File</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border/60" />
            <span>OR PASTE JSON</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Option 2: Paste JSON Text */}
          <div className="space-y-1.5">
            <Label htmlFor="import-json" className="text-xs font-medium text-foreground">
              Collection JSON Text
            </Label>
            <textarea
              id="import-json"
              rows={5}
              placeholder='{"name": "My Pack", "mods": [...]}'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full text-xs font-mono p-2 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20">
              {errorMsg}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isImporting || !jsonText.trim()}
            onClick={handleImportText}
            className="text-xs gap-1.5 cursor-pointer"
          >
            {isImporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            <span>Import from Text</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

