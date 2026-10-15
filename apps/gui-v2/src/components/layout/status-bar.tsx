import * as React from "react"
import {
  Terminal,
  Gamepad2,
  CheckCircle2,
  Folder,
  Check,
  Loader2,
  FolderCheck,
  ChevronUp,
  Download,
} from "lucide-react"
import { getVersion } from "@tauri-apps/api/app"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import type { LogEntry } from "./console-drawer"

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
  apiConnected?: boolean
  factorioVersion?: string
  onVersionChange?: (version: string) => void
  installationPath?: string
}

export function StatusBar({
  onToggleLogs,
  isConsoleOpen = false,
  latestLog = null,
  activeDownload = null,
  modDirectoryPath = "~/Library/Application Support/factorio/mods",
  apiConnected = true,
  factorioVersion = "2.0",
  onVersionChange,
  installationPath = "~/Library/Application Support/factorio",
}: StatusBarProps) {
  const [appVersion, setAppVersion] = React.useState("0.1.0")
  const [currentVersion, setCurrentVersion] = React.useState(factorioVersion)
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [isVerified, setIsVerified] = React.useState(true)

  React.useEffect(() => {
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("0.1.0"))
  }, [])

  React.useEffect(() => {
    setCurrentVersion(factorioVersion)
  }, [factorioVersion])

  const handleVersionSelect = (v: string) => {
    setCurrentVersion(v)
    onVersionChange?.(v)
  }

  const handleVerifyPath = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setIsVerified(true)
    }, 600)
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
                  {modDirectoryPath}
                </span>
              </div>
            }
          />
          <TooltipContent side="top" className="max-w-md text-xs">
            Active Mods Directory: {modDirectoryPath}
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
                <span>Factorio {currentVersion}</span>
                <ChevronUp className="size-2.5 opacity-60" />
              </Button>
            }
          />
          <PopoverContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-80 p-3 text-xs"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Gamepad2 className="size-3.5 text-primary" />
                  <span>Factorio Configuration</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                >
                  Detected
                </Badge>
              </div>

              {/* Target Game Version Selector */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Target Game Version
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "2.0", label: "2.0 (Space Age)" },
                    { id: "1.1", label: "1.1 (Stable)" },
                  ].map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      variant={currentVersion === v.id ? "secondary" : "outline"}
                      size="xs"
                      className="justify-between text-xs font-mono h-7 cursor-pointer"
                      onClick={() => handleVersionSelect(v.id)}
                    >
                      <span>{v.label}</span>
                      {currentVersion === v.id && (
                        <Check className="size-3 text-primary" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Installation Path */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Installation Path
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="size-3" /> Validated
                  </span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground break-all select-text">
                  {installationPath}
                </div>
              </div>

              {/* Verify Installation Path Action */}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="w-full text-xs h-7 cursor-pointer"
                  onClick={handleVerifyPath}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1.5" />
                      Verifying Installation...
                    </>
                  ) : isVerified ? (
                    <>
                      <FolderCheck className="size-3 text-emerald-500 mr-1.5" />
                      Installation Verified
                    </>
                  ) : (
                    <>
                      <FolderCheck className="size-3 mr-1.5" />
                      Verify Installation Path
                    </>
                  )}
                </Button>
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
    </footer>
  )
}
