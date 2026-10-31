import * as React from "react"
import { Plus, Layers, RefreshCw, Download, AlertTriangle, Save, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/toast"
import { CollectionCard } from "./collection-card"
import { CollectionEditor } from "./collection-editor"
import { CollectionImportDialog } from "./collection-import-dialog"
import { CollectionInspectorDialog } from "./collection-inspector-dialog"
import { MissingModsDialog } from "./missing-mods-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useCollectionsStore, isProfileDirty } from "@/stores/use-collections-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import type { CollectionProfile, ProfileModEntry, MissingModDetail } from "../types"
import { getMissingProfileMods } from "../utils"

export function CollectionsView() {
  const collections = useCollectionsStore((s) => s.collections)
  const isLoading = useCollectionsStore((s) => s.isLoading)
  const loadCollections = useCollectionsStore((s) => s.loadCollections)
  const applyCollection = useCollectionsStore((s) => s.applyCollection)
  const deleteCollection = useCollectionsStore((s) => s.deleteCollection)
  const updateProfileWithInstalledMods = useCollectionsStore((s) => s.updateProfileWithInstalledMods)
  const activeProfileId = useCollectionsStore((s) => s.activeProfileId)
  const isApplyingProfile = useCollectionsStore((s) => s.isApplyingProfile)
  const installedMods = useModManagerStore((s) => s.mods)
  const loadMods = useModManagerStore((s) => s.loadMods)

  const activeProfile = React.useMemo(
    () => collections.find((c) => c.id === activeProfileId) || null,
    [collections, activeProfileId]
  )
  const isDirty = React.useMemo(
    () => !isApplyingProfile && isProfileDirty(activeProfile, installedMods),
    [activeProfile, installedMods, isApplyingProfile]
  )

  const [isEditorOpen, setIsEditorOpen] = React.useState(false)
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [selectedProfileForInspect, setSelectedProfileForInspect] = React.useState<CollectionProfile | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false)

  // Missing mods confirmation state
  const [missingModsProfile, setMissingModsProfile] = React.useState<CollectionProfile | null>(null)
  const [missingModsList, setMissingModsList] = React.useState<MissingModDetail[]>([])
  const [pendingDisableOtherMods, setPendingDisableOtherMods] = React.useState(true)
  const [isMissingModsOpen, setIsMissingModsOpen] = React.useState(false)

  // Profile deletion confirmation state
  const [profileToDelete, setProfileToDelete] = React.useState<CollectionProfile | null>(null)

  React.useEffect(() => {
    loadCollections()
    loadMods(true)
  }, [loadCollections, loadMods])

  // Sync selected profile if collections change
  React.useEffect(() => {
    if (selectedProfileForInspect) {
      const updated = collections.find((c) => c.id === selectedProfileForInspect.id)
      if (updated) {
        setSelectedProfileForInspect(updated)
      }
    }
  }, [collections])

  const handleInspect = (profile: CollectionProfile) => {
    setSelectedProfileForInspect(profile)
    setIsInspectorOpen(true)
  }

  const handleApplyFromDialog = async (profile: CollectionProfile, disableOtherMods: boolean) => {
    const profileMods = Array.isArray(profile?.mods) ? profile.mods.filter(Boolean) : []
    const missing = getMissingProfileMods(profileMods, installedMods || [])

    if (missing.length > 0) {
      setPendingDisableOtherMods(disableOtherMods)
      setMissingModsProfile(profile)
      setMissingModsList(missing)
      setIsMissingModsOpen(true)
    } else {
      try {
        await applyCollection(profile.id, disableOtherMods)
        toast.add({
          type: "success",
          title: "Collection applied",
          description: disableOtherMods
            ? `Switched to "${profile.name}". Other installed mods were disabled.`
            : `Applied "${profile.name}". Other installed mods preserved their state.`,
        })
      } catch (err: any) {
        console.error("Failed to apply profile:", err)
        toast.add({
          type: "error",
          title: "Failed to apply profile",
          description: err?.message || "Could not apply profile configuration.",
        })
      }
    }
  }

  const handleDeleteProfile = (profile: CollectionProfile) => {
    setProfileToDelete(profile)
  }

  const handleConfirmDelete = async () => {
    if (!profileToDelete) return
    try {
      await deleteCollection(profileToDelete.id)
      if (selectedProfileForInspect?.id === profileToDelete.id) {
        setIsInspectorOpen(false)
        setSelectedProfileForInspect(null)
      }
      toast.add({
        type: "success",
        title: "Profile deleted",
        description: `Profile "${profileToDelete.name}" was removed.`,
      })
    } catch (err: any) {
      toast.add({
        type: "error",
        title: "Failed to delete profile",
        description: err?.message || "Could not delete profile.",
      })
    } finally {
      setProfileToDelete(null)
    }
  }

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Layers className="size-6 text-primary shrink-0" />
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Playthrough Profiles</h2>
            <Badge variant="outline">
              {collections.length} Saved
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Save and switch between different mod configurations and mod settings for different game saves.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 cursor-pointer"
            onClick={() => setIsImportOpen(true)}
            aria-label="Import Collection Profile"
          >
            <Download className="size-3.5" />
            <span>Import</span>
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 cursor-pointer"
            onClick={() => setIsEditorOpen(true)}
            aria-label="Create New Collection Profile"
          >
            <Plus className="size-3.5" />
            <span>New Profile</span>
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {isDirty && activeProfile && (
        <Alert variant="warning" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <AlertTitle>Profile Modified: {activeProfile.name}</AlertTitle>
              <AlertDescription>
                Installed mods have changed since this profile was loaded. The saved profile remains protected and unchanged.
              </AlertDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs cursor-pointer gap-1.5"
              onClick={async () => {
                try {
                  await updateProfileWithInstalledMods(activeProfile.id, installedMods)
                  toast.add({
                    type: "success",
                    title: "Profile saved",
                    description: `Active profile "${activeProfile.name}" updated successfully.`,
                  })
                } catch (err: any) {
                  toast.add({
                    type: "error",
                    title: "Cannot save collection",
                    description: err?.message || "Please fix dependency issues before saving.",
                    priority: "high",
                  })
                }
              }}
              aria-label="Save current mod state to profile"
            >
              <Save className="size-3" />
              <span>Save Changes</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs cursor-pointer gap-1.5"
              onClick={() => handleInspect(activeProfile)}
              aria-label="Revert to profile state"
            >
              <Undo2 className="size-3" />
              <span>Revert</span>
            </Button>
          </div>
        </Alert>
      )}

      {/* Grid of Profiles */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <RefreshCw className="size-5 animate-spin text-primary" />
          <span>Loading profiles...</span>
        </div>
      ) : collections.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-lg space-y-3">
          <Layers className="size-8 mx-auto text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground text-sm">No Collections Saved</p>
            <p className="max-w-sm mx-auto text-[11px]">
              Create a profile from your currently enabled mods or download queue to switch playthroughs in 1 click.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              onClick={() => setIsImportOpen(true)}
              aria-label="Import Collection Profile"
            >
              <Download className="size-3.5" />
              <span>Import Profile</span>
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              onClick={() => setIsEditorOpen(true)}
            >
              <Plus className="size-3.5" />
              <span>Create First Profile</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((profile) => (
            <CollectionCard
              key={profile.id}
              profile={profile}
              onInspect={handleInspect}
              onApplyRequest={(prof) => handleApplyFromDialog(prof, true)}
              onDeleteRequest={handleDeleteProfile}
            />
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <CollectionEditor open={isEditorOpen} onOpenChange={setIsEditorOpen} />

      {/* Import Dialog */}
      <CollectionImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImported={(profile) => {
          handleInspect(profile)
        }}
      />

      {/* Inspector / Apply Dialog */}
      <CollectionInspectorDialog
        profile={selectedProfileForInspect}
        open={isInspectorOpen}
        onOpenChange={setIsInspectorOpen}
        onApply={handleApplyFromDialog}
        onDelete={handleDeleteProfile}
      />

      {/* Missing Mods Warning & Download Dialog */}
      <MissingModsDialog
        profile={missingModsProfile}
        missingMods={missingModsList}
        disableOtherMods={pendingDisableOtherMods}
        open={isMissingModsOpen}
        onOpenChange={setIsMissingModsOpen}
        onCompleted={() => {
          loadMods()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!profileToDelete}
        onOpenChange={(open) => !open && setProfileToDelete(null)}
        title="Delete Profile"
        description={`Are you sure you want to delete profile "${profileToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
