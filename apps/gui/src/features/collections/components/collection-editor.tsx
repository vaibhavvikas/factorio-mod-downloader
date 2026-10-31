import * as React from "react"
import { AlertCircle, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { useCollectionsStore, validateCollectionForSave, type CollectionValidationError } from "@/stores/use-collections-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { useModQueueStore } from "@/stores/use-mod-queue-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import type { CollectionProfile, ProfileModEntry } from "../types"

interface CollectionEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectionEditor({ open, onOpenChange }: CollectionEditorProps) {
  const saveCollection = useCollectionsStore((s) => s.saveCollection)
  const installedMods = useModManagerStore((s) => s.mods) || []
  const queueMods = useModQueueStore((s) => s.targetMods) || []
  const factorioVersion = useSettingsStore((s) => s.factorioVersion)

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [sourceType, setSourceType] = React.useState<"enabled" | "all" | "queue">("enabled")
  const [snapshotSettings, setSnapshotSettings] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<CollectionValidationError[]>([])

  // Reset errors when dialog closes or opened
  React.useEffect(() => {
    if (open) {
      setErrorMsg(null)
      setValidationErrors([])
    }
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg("Please provide a name for this collection profile.")
      return
    }

    setIsSaving(true)
    setErrorMsg(null)
    setValidationErrors([])

    let profileMods: ProfileModEntry[] = []

    if (sourceType === "queue") {
      profileMods = queueMods.map((qm) => ({
        name: qm.name,
        version: qm.selectedVersion || "latest",
        enabled: true,
      }))
    } else if (sourceType === "enabled") {
      profileMods = installedMods
        .filter((m) => m && m.enabled && m.name !== "base")
        .map((m) => ({
          name: m.name,
          version: m.activeVersion || "0.0.0",
          enabled: true,
        }))
    } else {
      // All installed mods included as enabled in this profile
      profileMods = installedMods
        .filter((m) => m && m.name !== "base")
        .map((m) => ({
          name: m.name,
          version: m.activeVersion || "0.0.0",
          enabled: true,
        }))
    }

    // Dependency health validation: Block save if any parent is missing its child dependency
    const candidateNames = profileMods.map((m) => m.name)
    const validation = validateCollectionForSave(candidateNames, installedMods)

    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      setIsSaving(false)
      toast.add({
        type: "error",
        title: "Cannot save collection",
        description: "Missing required dependencies detected. Please fix them before saving.",
        priority: "high",
      })
      return
    }

    const newProfile: CollectionProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      factorioVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mods: profileMods,
      hasSettingsSnapshot: false,
    }

    try {
      await saveCollection(newProfile, snapshotSettings)
      setName("")
      setDescription("")
      onOpenChange(false)
      toast.add({
        type: "success",
        title: "Collection saved",
        description: `Profile "${newProfile.name}" was created successfully.`,
      })
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || "Failed to save collection"
      setErrorMsg(msg)
      toast.add({
        type: "error",
        title: "Cannot save collection",
        description: msg,
        priority: "high",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Collection Profile</DialogTitle>
          <DialogDescription>
            Profiles capture mod configurations for switchable playthroughs.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-2.5 rounded bg-destructive/10 text-destructive text-xs">
            {errorMsg}
          </div>
        )}

        {validationErrors.length > 0 && (
          <Alert variant="destructive" className="text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <AlertTitle className="text-xs font-semibold">
              Cannot Save: Fix Dependencies First
            </AlertTitle>
            <AlertDescription className="space-y-1.5 mt-1 text-xs">
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{err.modTitle}:</span> {err.message}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-destructive/80 font-medium pt-1">
                Install or enable all required dependencies before saving this collection profile.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground">Profile Name</Label>
            <Input
              placeholder="e.g. Space Exploration Playthrough"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground">Description (optional)</Label>
            <textarea
              placeholder="Notes, modpack version, or save file context..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none h-18"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground">Capture Mods From:</Label>
            <div className="grid grid-cols-3 w-full h-8 p-0.5 bg-muted/60 text-xs gap-1 select-none font-sans rounded-lg">
              <button
                type="button"
                onClick={() => setSourceType("enabled")}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all",
                  sourceType === "enabled"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Enabled Mods
              </button>
              <button
                type="button"
                onClick={() => setSourceType("all")}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-all",
                  sourceType === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Installed
              </button>
              <button
                type="button"
                disabled={queueMods.length === 0}
                onClick={() => setSourceType("queue")}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-all",
                  queueMods.length === 0
                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                    : sourceType === "queue"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground cursor-pointer"
                )}
              >
                Queue ({queueMods.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Checkbox
              id="snapshot-settings"
              checked={snapshotSettings}
              onCheckedChange={(c) => setSnapshotSettings(!!c)}
            />
            <Label htmlFor="snapshot-settings" className="text-xs text-foreground cursor-pointer select-none">
              Snapshot current <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">mod-settings.dat</code>
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="cursor-pointer text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer text-xs">
            {isSaving ? "Saving..." : "Create Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
