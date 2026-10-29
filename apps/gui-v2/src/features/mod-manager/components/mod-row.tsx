import * as React from "react"
import { MoreVertical, FolderArchive, Info, Trash2, ExternalLink, CheckCircle2, ArrowUpCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ModThumbnail } from "./mod-thumbnail"
import { HealthBadge } from "./health-badge"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import { cn } from "@/lib/utils"
import type { InstalledModGroup } from "../types"

interface ModRowProps {
  mod: InstalledModGroup
  isDependency?: boolean
  isSingleCard?: boolean
  tag?: string | null
  factorioVersion?: string | null
  onViewDetails: (mod: InstalledModGroup) => void
  onManageVersions: (mod: InstalledModGroup) => void
  onUninstall: (name: string) => void
  onResolveDependencies?: (mod: InstalledModGroup) => void
}

export function ModRow({
  mod,
  isDependency = false,
  isSingleCard = false,
  tag,
  factorioVersion,
  onViewDetails,
  onManageVersions,
  onUninstall,
  onResolveDependencies,
}: ModRowProps) {
  const toggleMod = useModManagerStore((s) => s.toggleMod)
  const updateMod = useModManagerStore((s) => s.updateMod)
  const selectedMods = useModManagerStore((s) => s.selectedMods)
  const toggleSelectMod = useModManagerStore((s) => s.toggleSelectMod)
  const isSelected = selectedMods.has(mod.name)
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleUpdate = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!mod.latestVersion || isUpdating) return
    setIsUpdating(true)
    try {
      await updateMod(mod.name, mod.latestVersion)
      toast.add({
        type: "success",
        title: "Update Started",
        description: `Downloading ${mod.title} v${mod.latestVersion} and its required dependencies`,
      })
    } catch (err: any) {
      toast.add({
        type: "error",
        title: "Update Failed",
        description: typeof err === "string" ? err : err?.message || "Failed to update mod",
        priority: "high",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const storeFactorioVersion = useSettingsStore((s) => s.factorioVersion)
  const effectiveFactorioVersion = factorioVersion ?? storeFactorioVersion

  const isFactorioIncompatible = Boolean(
    !mod.isVirtual &&
    effectiveFactorioVersion &&
    effectiveFactorioVersion !== "all" &&
    effectiveFactorioVersion !== "any" &&
    mod.factorioVersion &&
    !isFactorioVersionCompatible(mod.factorioVersion, effectiveFactorioVersion)
  )

  const handleToggle = (checked: boolean) => {
    toggleMod(mod.name, checked)
  }

  return (
    <div
      id={`mod-row-${mod.name}`}
      data-mod-id={mod.name}
      className={cn(
        "group relative select-none transition-colors min-h-[52px] flex items-center justify-between gap-3 px-4 py-2",
        isSingleCard
          ? cn(
              "rounded-xl border border-border bg-card shadow-xs hover:border-border/80",
              isSelected && "ring-1 ring-primary border-primary/50 bg-primary/5"
            )
          : cn(
              !isDependency && "hover:bg-muted/40 focus-visible:bg-muted/40 outline-none",
              !isDependency && isSelected && "bg-primary/5"
            ),
        !mod.enabled && "opacity-75 hover:opacity-100"
      )}
    >
      {/* Left Column: Checkbox, Thumbnail, Metadata */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelectMod(mod.name)}
          className="cursor-pointer shrink-0"
          aria-label={`Select ${mod.title}`}
        />

        <div className="cursor-pointer shrink-0" onClick={() => onViewDetails(mod)}>
          <ModThumbnail
            name={mod.name}
            title={mod.title}
            thumbnail={mod.thumbnail}
            category={mod.category}
          />
        </div>

        {/* Title, Version, Badges & Sub-details */}
        <div className="min-w-0 flex-1 flex flex-col justify-center leading-normal overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 w-full">
            <span
              className="font-semibold text-sm text-foreground truncate cursor-pointer hover:underline font-sans min-w-0"
              onClick={() => onViewDetails(mod)}
              aria-label={mod.title}
            >
              {mod.title}
            </span>

            {mod.activeVersion ? (
              <button
                type="button"
                className="font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:underline shrink-0"
                onClick={() => onViewDetails(mod)}
                aria-label={`View details and versions for ${mod.title}`}
              >
                v{mod.activeVersion}
              </button>
            ) : null}

            {/* Tag badge (e.g. unused / optional) */}
            {tag && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-2 font-medium text-amber-500 border-amber-500/40 shrink-0"
              >
                {tag}
              </Badge>
            )}

            {/* Update badge */}
            {mod.hasUpdate && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-2 font-medium text-blue-600 dark:text-blue-400 border-blue-500/30 shrink-0 cursor-pointer hover:bg-blue-500/10 transition-colors gap-1"
                      onClick={handleUpdate}
                      aria-label={`Update ${mod.title} to v${mod.latestVersion || "latest"}`}
                    >
                      {isUpdating ? <Spinner data-icon="inline-start" /> : <ArrowUpCircle className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />}
                      <span>v{mod.latestVersion}</span>
                    </Badge>
                  }
                />
                <TooltipContent side="top">
                  Click to update to v{mod.latestVersion} and fetch required dependencies
                </TooltipContent>
              </Tooltip>
            )}

            {/* Unpacked Dev Badge */}
            {mod.isDirectory && (
              <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium text-amber-600 dark:text-amber-400 border-amber-500/30 shrink-0">
                Unpacked
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <span className="font-mono">{mod.name}</span>
            {mod.author && (
              <>
                <span>•</span>
                <span className="truncate">{mod.author}</span>
              </>
            )}
            {mod.stashedVersions.length > 0 && (
              <>
                <span>•</span>
                <button
                  type="button"
                  className="text-primary hover:underline font-mono text-xs cursor-pointer"
                  onClick={() => onViewDetails(mod)}
                  aria-label={`View ${mod.stashedVersions.length} other versions for ${mod.title}`}
                >
                  +{mod.stashedVersions.length} stashed
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right-aligned Status Column for Error / Health / Incompatible Pill */}
      {(isFactorioIncompatible || (mod.healthIssues && mod.healthIssues.length > 0)) && (
        <div className="flex items-center justify-end shrink-0 w-[124px]">
          <HealthBadge
            issues={mod.healthIssues}
            factorioIncompatible={isFactorioIncompatible}
            factorioVersion={effectiveFactorioVersion}
            modFactorioVersion={mod.factorioVersion}
            onClick={onResolveDependencies ? () => onResolveDependencies(mod) : undefined}
          />
        </div>
      )}

      {/* Right Column: Toggle Switch & Actions Menu */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <Switch
                checked={mod.enabled}
                disabled={!mod.activeFilePath && !mod.activeVersion}
                onCheckedChange={handleToggle}
                className="cursor-pointer"
                aria-label={mod.enabled ? "Disable mod" : "Enable mod"}
              />
            }
          />
          <TooltipContent side="top">
            {!mod.activeFilePath && !mod.activeVersion
              ? "Mod file is missing from disk"
              : mod.enabled
              ? "Disable mod"
              : "Enable mod"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More actions for ${mod.title}`}
            className="size-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0 outline-none"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {mod.hasUpdate && mod.latestVersion && (
              <DropdownMenuItem
                onClick={handleUpdate}
                disabled={isUpdating}
                className="text-blue-600 dark:text-blue-400 focus:text-blue-600 cursor-pointer"
              >
                <ArrowUpCircle className="size-4 mr-2" />
                <span>Update to v{mod.latestVersion}</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onViewDetails(mod)}>
              <Info className="size-4 mr-2" />
              <span>View Details</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onManageVersions(mod)}>
              <FolderArchive className="size-4 mr-2" />
              <span>Manage Versions</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
                  openUrl(`https://mods.factorio.com/mod/${mod.name}`)
                })
              }}
            >
              <ExternalLink className="size-4 mr-2" />
              <span>View on Mod Portal</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => onUninstall(mod.name)}
            >
              <Trash2 className="size-4 mr-2" />
              <span>Uninstall...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
