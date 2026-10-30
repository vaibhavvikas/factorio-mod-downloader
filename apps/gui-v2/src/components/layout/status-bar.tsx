import * as React from "react"
import {
  Terminal,
  Gamepad2,
  Folder,
  Check,
  ChevronUp,
  Download,
} from "lucide-react"
import { getVersion } from "@tauri-apps/api/app"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, getShortcutLabel } from "@/lib/utils"
import { useSettingsStore, DEFAULT_FACTORIO_VERSIONS } from "@/stores/use-settings-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { useApiStore } from "@/stores/use-api-store"
import type { LogEntry } from "./console-drawer"
import { FactorioVersionConfirmDialog } from "./factorio-version-confirm-dialog"

export interface ActiveDownloadInfo {
  modName: string
  progress: number // 0 to 100
  statusText?: string
}

export interface StatusBarProps {
  onToggleLogs?: () => void
  isConsoleOpen?: boolean
  latestLog?: LogEntry | null
  activeDownload?: ActiveDownloadInfo | null
  modDirectoryPath?: string
  factorioVersion?: string
  onVersionChange?: (version: string) => void
}

export function StatusBar({
  onToggleLogs,
  isConsoleOpen = false,
  latestLog = null,
  activeDownload = null,
  modDirectoryPath,
  factorioVersion,
  onVersionChange,
}: StatusBarProps) {
  const storeVersion = useSettingsStore((s) => s.factorioVersion)
  const setStoreVersion = useSettingsStore((s) => s.setFactorioVersion)
  const handleFactorioVersionChange = useModManagerStore((s) => s.handleFactorioVersionChange)
  const storeModsFolder = useSettingsStore((s) => s.modsFolder)
  const apiConnected = useApiStore((s) => s.apiConnected)

  const [appVersion, setAppVersion] = React.useState("0.5.0")
  const currentVersion = factorioVersion ?? storeVersion
  const activeModsPath = modDirectoryPath || storeModsFolder || "Factorio Mods"

  // Version change confirmation dialog state
  const [pendingVersion, setPendingVersion] = React.useState<string | null>(null)
  const [isConfirmingVersion, setIsConfirmingVersion] = React.useState(false)

  React.useEffect(() => {
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("0.5.0"))
  }, [])

  const handleVersionSelect = async (v: string) => {
    if (v === currentVersion) return
    setPendingVersion(v)
    setIsConfirmingVersion(true)
  }

  const handleConfirmVersionChange = async () => {
    const target = pendingVersion
    if (!target) return
    setIsConfirmingVersion(false)
    setPendingVersion(null)
    try {
      await setStoreVersion(target)
      await handleFactorioVersionChange(target)
      onVersionChange?.(target)
    } catch (e) {
      console.error("Failed to change Factorio version:", e)
    }
  }

  const dotColorClass = React.useMemo(() => {
    if (!latestLog) return "bg-primary"
    switch (latestLog.level) {
      case "error":
        return "bg-rose-500"
      case "warn":
        return "bg-amber-500"
      case "success":
        return "bg-emerald-500"
      default:
        return "bg-primary"
    }
  }, [latestLog])

  const displayMessage = latestLog?.message || "System active. Ready."

  return (
    <footer className="h-8 shrink-0 border-t border-border bg-sidebar text-sidebar-foreground flex items-center justify-between px-3 text-xs font-sans select-none z-20 w-full">
      {/* Left section: Live Log Telemetry (Clipped) & Optional Active Download Progress */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-4 overflow-hidden">
        {/* Terminal / Logs Toggle */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                id="status-bar-console-trigger"
                type="button"
                onClick={onToggleLogs}
                className={cn(
                  "flex items-center gap-2 transition-colors cursor-pointer text-left min-w-0 max-w-[240px] sm:max-w-[320px] md:max-w-[420px] select-none group py-0.5 px-1.5 rounded hover:bg-muted/40",
                  isConsoleOpen
                    ? "text-foreground font-medium bg-muted/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={isConsoleOpen ? "Close Console" : "Open Console"}
                aria-expanded={isConsoleOpen}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      dotColorClass
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      dotColorClass
                    )}
                  />
                </span>
                <Terminal className="size-3.5 shrink-0 text-primary" />
                <span className="font-mono text-[11px] truncate">
                  {displayMessage}
                </span>
              </button>
            }
          />
          <TooltipContent side="top" className="flex items-center gap-1.5 text-xs">
            <span>{isConsoleOpen ? "Close Console" : "Open Console"}</span>
            <kbd
              data-slot="kbd"
              className="inline-flex items-center justify-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/20 text-background border border-background/25 font-semibold leading-none shrink-0"
            >
              {getShortcutLabel("J")}
            </kbd>
          </TooltipContent>
        </Tooltip>

        {activeDownload && (
          <>
            <Separator className="h-3 bg-zinc-800" orientation="vertical" />
            <div className="flex items-center gap-2 min-w-0">
              <Download className="size-3.5 text-primary animate-bounce shrink-0" />
              <span className="font-medium text-xs truncate max-w-[120px] sm:max-w-[180px]">
                {activeDownload.modName}
              </span>
              <Progress
                value={activeDownload.progress}
                className="w-16 sm:w-24 h-1.5 shrink-0"
              />
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                {Math.round(activeDownload.progress)}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right section: API Status, Folder Location, Factorio Version & App Version */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* API Connection Telemetry */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              apiConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )}
          />
          <span className="text-[11px] text-muted-foreground font-mono">
            API:{" "}
            <span
              className={
                apiConnected
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-rose-500 font-medium"
              }
            >
              {apiConnected ? "Online" : "Offline"}
            </span>
          </span>
        </div>

        <Separator className="h-3 bg-zinc-800" orientation="vertical" />

        {/* Active Mod Directory Telemetry */}
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-default max-w-[180px] sm:max-w-[240px] truncate">
                <Folder className="size-3 text-muted-foreground shrink-0" />
                <span className="font-mono text-[11px] truncate">
                  {activeModsPath}
                </span>
              </div>
            }
          />
          <TooltipContent side="top" className="max-w-md text-xs">
            Active Mods Directory: {activeModsPath}
          </TooltipContent>
        </Tooltip>

        <Separator className="h-3 bg-zinc-800" orientation="vertical" />
        {/* Interactive Factorio Version Ghost Button with Popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="h-6 px-1.5 gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Factorio Game Version and Path Settings"
              >
                <Gamepad2 className="size-3 text-primary shrink-0" />
                <span>Factorio {currentVersion === "any" ? "Any" : `v${currentVersion.replace(/^v/, "")}`}</span>
                <ChevronUp className="size-2.5 opacity-60" />
              </Button>
            }
          />
          <PopoverContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-64 p-3 text-xs"
          >
            <div className="space-y-2.5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Gamepad2 className="size-3.5 text-primary" />
                  <span>Target Factorio Version</span>
                </div>
              </div>

              {/* Target Game Version Selector */}
              <div className="grid grid-cols-2 gap-1.5">
                {DEFAULT_FACTORIO_VERSIONS.map((v) => (
                  <Button
                    key={v.value}
                    type="button"
                    variant={currentVersion === v.value ? "secondary" : "outline"}
                    size="xs"
                    className="justify-between text-xs font-mono h-7 cursor-pointer"
                    onClick={() => handleVersionSelect(v.value)}
                  >
                    <span>{v.label.replace("Factorio ", "")}</span>
                    {currentVersion === v.value && (
                      <Check className="size-3 text-primary" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator className="h-3 bg-zinc-800" orientation="vertical" />

        {/* App Version */}
        <span className="text-[11px] font-mono text-muted-foreground font-medium">
          v{appVersion}
        </span>
      </div>

      {/* Version Change Confirmation Dialog */}
      <FactorioVersionConfirmDialog
        open={isConfirmingVersion}
        onOpenChange={(open) => {
          if (!open) setPendingVersion(null)
          setIsConfirmingVersion(open)
        }}
        fromVersion={currentVersion}
        toVersion={pendingVersion || ""}
        onConfirm={handleConfirmVersionChange}
        isProcessing={isConfirmingVersion}
      />
    </footer>
  )
}
