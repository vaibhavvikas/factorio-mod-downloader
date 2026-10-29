import * as React from "react"
import { Play, Trash2, Calendar, CheckCircle2, Gamepad2, Settings, Share2, ExternalLink, Save, Undo2 } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { useCollectionsStore, isProfileDirty } from "@/stores/use-collections-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { CollectionProfile } from "../types"

interface CollectionCardProps {
  profile: CollectionProfile
  onInspect?: (profile: CollectionProfile) => void
  onApplyRequest?: (profile: CollectionProfile) => void
  onDeleteRequest?: (profile: CollectionProfile) => void
}

function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return "Recently"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "Recently"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function CollectionCard({ profile, onInspect, onApplyRequest, onDeleteRequest }: CollectionCardProps) {
  const deleteCollection = useCollectionsStore((s) => s.deleteCollection)
  const exportCollectionDialog = useCollectionsStore((s) => s.exportCollectionDialog)
  const updateProfileWithInstalledMods = useCollectionsStore((s) => s.updateProfileWithInstalledMods)
  const activeProfileId = useCollectionsStore((s) => s.activeProfileId)
  const isApplyingProfile = useCollectionsStore((s) => s.isApplyingProfile)
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)
  const installedMods = useModManagerStore((s) => s.mods)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false)

  const isActive = activeProfileId === profile.id
  const isDefault = profile.id === "default"
  const isDirty = !isApplyingProfile && isActive && isProfileDirty(profile, installedMods)
  const enabledCount = (profile.mods || []).filter((m) => m?.enabled).length

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onApplyRequest) {
      onApplyRequest(profile)
    }
  }

  const handleSaveChanges = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateProfileWithInstalledMods(profile.id, installedMods)
      toast.add({
        type: "success",
        title: "Profile updated",
        description: `Changes to "${profile.name}" saved successfully.`,
      })
    } catch (err: any) {
      toast.add({
        type: "error",
        title: "Cannot save collection",
        description: err?.message || "Please fix dependency issues before saving.",
        priority: "high",
      })
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDeleteRequest) {
      onDeleteRequest(profile)
    } else {
      setIsConfirmDeleteOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteCollection(profile.id)
      toast.add({
        type: "success",
        title: "Profile deleted",
        description: `Profile "${profile.name}" was removed.`,
      })
    } catch (err: any) {
      toast.add({
        type: "error",
        title: "Failed to delete profile",
        description: err?.message || "Could not delete profile.",
      })
    }
  }

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const path = await exportCollectionDialog(profile.id)
      if (path) {
        toast.add({
          type: "success",
          title: "Profile exported",
          description: `Exported to ${path}`,
        })
      }
    } catch (err) {
      console.error("Failed to export collection:", err)
      toast.add({
        type: "error",
        title: "Export failed",
        description: "Could not export collection profile to file.",
      })
    }
  }

  const formattedDate = formatSafeDate(profile.updatedAt || profile.updated_at || profile.createdAt || profile.created_at)

  return (
    <Card
      className="flex flex-col justify-between border-border/80 hover:border-primary/50 hover:shadow-sm transition-all duration-150 cursor-pointer group [--card-spacing:--spacing(5)]"
      onClick={() => onInspect?.(profile)}
    >
      <CardHeader className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {profile.name}
          </CardTitle>
          {isActive && (
            isDirty ? (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shrink-0">
                <span className="inline-block size-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
                <span>Modified</span>
              </Badge>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 shrink-0">
                <CheckCircle2 data-icon="inline-start" />
                <span>Active</span>
              </Badge>
            )
          )}
        </div>

        {profile.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{profile.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Click to inspect mods in this profile.</p>
        )}
      </CardHeader>

      <CardContent className="text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {enabledCount} {enabledCount === 1 ? "mod" : "mods"}
            </Badge>
            {profile.factorioVersion && (
              <Badge variant="secondary">
                <Gamepad2 data-icon="inline-start" />
                <span>{profile.factorioVersion}</span>
              </Badge>
            )}
            {profile.hasSettingsSnapshot && (
              <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-900">
                <Settings data-icon="inline-start" />
                <span>Settings Snapshot</span>
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono shrink-0 ml-auto">
            <Calendar className="size-3" />
            <span>Updated {formattedDate}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        {isDirty ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1 cursor-pointer flex-1"
              disabled={isFactorioRunning}
              onClick={handleSaveChanges}
              aria-label="Save current mod state to profile"
            >
              <Save className="size-3" />
              <span>Save Changes</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 cursor-pointer"
              disabled={isFactorioRunning}
              onClick={handleApply}
              aria-label="Revert to profile state"
            >
              <Undo2 className="size-3" />
              <span>Revert</span>
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={isActive ? "secondary" : "default"}
            className="h-7 text-xs gap-1.5 cursor-pointer flex-1"
            disabled={isFactorioRunning}
            onClick={handleApply}
            aria-label={isActive ? "Re-apply Profile" : "Apply Profile"}
          >
            <Play className="size-3" />
            <span>{isActive ? "Re-Apply" : "Apply Profile"}</span>
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                onClick={handleExport}
                aria-label="Export Profile"
              >
                <Share2 className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Export to JSON file</TooltipContent>
        </Tooltip>

        {!isDefault && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                  onClick={handleDelete}
                  aria-label="Delete Profile"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Delete profile</TooltipContent>
          </Tooltip>
        )}
      </CardFooter>

      {/* Fallback confirmation dialog when card is used standalone */}
      <ConfirmDialog
        open={isConfirmDeleteOpen}
        onOpenChange={setIsConfirmDeleteOpen}
        title="Delete Profile"
        description={`Are you sure you want to delete profile "${profile.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
}
