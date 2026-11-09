import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Play,
  Trash2,
  Share2,
  Copy,
  Search,
  Gamepad2,
  Settings,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Layers,
} from "lucide-react"
import { cn, openModPortal } from "@/lib/utils"
import { useCollectionsStore } from "@/stores/use-collections-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import type { CollectionProfile, ProfileModEntry } from "../types"
import { getMissingProfileMods } from "../utils"

interface CollectionInspectorDialogProps {
  profile: CollectionProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: (profile: CollectionProfile, disableOtherMods: boolean) => void
  onDelete?: (profile: CollectionProfile) => void
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

export function CollectionInspectorDialog({
  profile,
  open,
  onOpenChange,
  onApply,
  onDelete,
}: CollectionInspectorDialogProps) {
  const exportCollectionDialog = useCollectionsStore((s) => s.exportCollectionDialog)
  const activeProfileId = useCollectionsStore((s) => s.activeProfileId)
  const installedMods = useModManagerStore((s) => s.mods) || []
  const isFactorioRunning = useModManagerStore((s) => s.isFactorioRunning)

  const [search, setSearch] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [disableOtherMods, setDisableOtherMods] = React.useState(true)

  // Reset state on open
  React.useEffect(() => {
    if (open) {
      setSearch("")
      setCopied(false)
      setDisableOtherMods(true)
    }
  }, [open, profile?.id])

  const profileMods: ProfileModEntry[] = React.useMemo(
    () =>
      Array.isArray(profile?.mods)
        ? profile.mods.filter((m) => m && m.name !== "base")
        : [],
    [profile?.mods]
  )

  const isActive = !!profile && activeProfileId === profile.id
  const isDefault = profile?.id === "default"

  const missingMods = React.useMemo(
    () => getMissingProfileMods(profileMods, installedMods || []),
    [profileMods, installedMods]
  )

  const missingMap = React.useMemo(
    () => new Map(missingMods.map((m) => [(m.mod.name || "").toLowerCase(), m])),
    [missingMods]
  )

  const displayedMods = React.useMemo(() => {
    if (!search.trim()) return profileMods
    const q = search.trim().toLowerCase()
    return profileMods.filter((m) => (m.name || "").toLowerCase().includes(q))
  }, [profileMods, search])

  if (!profile) return null

  const formattedDate = formatSafeDate(
    profile.updatedAt || profile.updated_at || profile.createdAt || profile.created_at
  )

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(profile, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleExport = async () => {
    try {
      await exportCollectionDialog(profile.id)
    } catch (err) {
      console.error("Export failed:", err)
    }
  }

  const handleApply = () => {
    onOpenChange(false)
    onApply?.(profile, disableOtherMods)
  }

  const handleDelete = () => {
    onDelete?.(profile)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={false}
        className="sm:max-w-2xl h-[min(88vh,660px)] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Header (No bottom separator) */}
        <DialogHeader className="px-6 pt-6 pb-2 space-y-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap pr-8">
            <Layers className="size-5 text-primary shrink-0" />
            <DialogTitle className="text-lg font-bold text-foreground leading-snug truncate">
              {profile.name}
            </DialogTitle>
            {isActive && (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 shrink-0">
                <CheckCircle2 data-icon="inline-start" />
                <span>Active</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground min-w-0">
            <DialogDescription className="text-xs text-muted-foreground line-clamp-1 truncate flex-1 min-w-0">
              {profile.description || "Collection profile details and active mod configuration."}
            </DialogDescription>
            <span className="text-[11px] font-mono flex items-center gap-1 text-muted-foreground shrink-0">
              <Calendar className="size-3" />
              Updated {formattedDate}
            </span>
          </div>

          {/* Metadata badges (optional version / settings) */}
          {(profile.factorioVersion || profile.hasSettingsSnapshot) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {profile.factorioVersion && (
                <Badge variant="secondary">
                  <Gamepad2 data-icon="inline-start" />
                  <span>Factorio {profile.factorioVersion}</span>
                </Badge>
              )}
              {profile.hasSettingsSnapshot && (
                <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-900">
                  <Settings data-icon="inline-start" />
                  <span>Settings Snapshot</span>
                </Badge>
              )}
            </div>
          )}

          {/* Missing mods warning banner */}
          {missingMods.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <span className="font-semibold">
                  {missingMods.length} {missingMods.length === 1 ? "mod" : "mods"} missing or requires version download
                </span>
                {" — "}applying this collection will prompt you to download missing mods and versions.
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Mod List Content Area */}
        <div className="flex flex-col flex-1 min-h-0 px-6 py-3 gap-3 overflow-hidden">
          {/* Single Combined Card for all collection mods */}
          <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-border/70 bg-card overflow-hidden shadow-xs">
            {/* Header: Title + Search */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-muted/30 shrink-0 gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span>Collection Mods</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
                  {profileMods.length}
                </Badge>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter mods..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs w-48 bg-background"
                />
              </div>
            </div>

            {/* Combined rows: One row directly below another with clean dividers and scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40 [scrollbar-width:thin] [scrollbar-color:oklch(0.56_0.021_213.5/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
              {displayedMods.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {search
                    ? `No mods in this collection match "${search}"`
                    : "No mods saved in this collection profile."}
                </div>
              ) : (
                displayedMods.map((mod) => {
                  const modName = mod.name || "unknown"
                  const missingInfo = missingMap.get(modName.toLowerCase())
                  const isMissing = Boolean(missingInfo)
                  return (
                    <div
                      key={modName}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3.5 py-2 text-xs transition-colors",
                        isMissing
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        <span
                          className={cn(
                            "font-medium truncate",
                            isMissing && "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {modName}
                        </span>
                        {missingInfo?.reason === "not_installed" && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] h-4 px-1.5 shrink-0 bg-amber-500/10 font-sans"
                          >
                            Not installed
                          </Badge>
                        )}
                        {missingInfo?.reason === "version_not_found" && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] h-4 px-1.5 shrink-0 bg-amber-500/10 font-sans"
                          >
                            v{mod.version} not found
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {mod.version && mod.version !== "latest" ? `v${mod.version}` : "latest"}
                        </span>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-primary cursor-pointer shrink-0"
                                aria-label={`Open ${modName} on Factorio Mod Portal`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openModPortal(modName)
                                }}
                              >
                                <ExternalLink className="size-3" />
                              </Button>
                            }
                          />
                          <TooltipContent>Open on Factorio Mod Portal</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Option: Disable other mods checkbox */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/70 bg-muted/30 shrink-0">
            <Checkbox
              id="disable-other-mods"
              checked={disableOtherMods}
              onCheckedChange={(checked) => setDisableOtherMods(!!checked)}
              aria-label="Disable other mods not in this collection"
              className="mt-0.5 cursor-pointer"
            />
            <label
              htmlFor="disable-other-mods"
              className="flex flex-col gap-0.5 cursor-pointer select-none"
            >
              <span className="text-xs font-semibold text-foreground">
                Disable other mods not in this collection
              </span>
              <span className="text-[11px] text-muted-foreground leading-normal">
                {disableOtherMods
                  ? "All other installed mods not listed in this collection will be disabled."
                  : "Other installed mods will keep their current enabled/disabled state."}
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/60 flex flex-row items-center justify-between gap-2 shrink-0">
          {/* Left: export actions */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              onClick={handleCopyJson}
              aria-label="Copy profile JSON to clipboard"
            >
              <Copy className="size-3.5" />
              <span>{copied ? "Copied!" : "Copy JSON"}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              onClick={handleExport}
              aria-label="Export profile to JSON file"
            >
              <Share2 className="size-3.5" />
              <span>Export</span>
            </Button>
            {!isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive cursor-pointer"
                onClick={handleDelete}
                aria-label="Delete this collection profile"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            )}
          </div>

          {/* Right: Cancel & Apply */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs cursor-pointer"
              onClick={() => onOpenChange(false)}
              aria-label="Cancel"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 cursor-pointer"
              disabled={isFactorioRunning}
              onClick={handleApply}
              aria-label={isActive ? "Re-apply this collection profile" : "Apply this collection profile"}
            >
              <Play className="size-3.5" />
              <span>{isActive ? "Re-Apply Collection" : "Apply Collection"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
