import * as React from "react"
import {
  Pause,
  Play,
  X,
  RotateCcw,
  CheckCircle2,
  Folder,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { FormattedDownloadTask } from "../types"
import { DownloadInfoPopover } from "./download-info-popover"

interface DownloadRowProps {
  task: FormattedDownloadTask
  isCompletedStyle?: boolean
  isHeldActive?: boolean
  modsFolder?: string | null
  onPause?: (rawId: string) => void
  onResume?: (rawId: string) => void
  onCancel?: (rawId: string) => void
  onRetry?: (rawId: string) => void
  onRemove?: (rawId: string) => void
  onOpenFolder?: () => void
  onHoverChange?: (taskId: string, isHovered: boolean) => void
  onPopoverOpenChange?: (taskId: string, isOpen: boolean) => void
}

function getInitials(title: string): string {
  const words = title.trim().split(/[\s_-]+/).filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase()
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "recently"
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 15) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `today ${hours}:${minutes}`
}

function cleanEtaString(eta?: string): string {
  if (!eta) return ""
  return eta.replace(/^about\s+/i, "").replace(/\s+left$/i, "").trim()
}

export function DownloadRow({
  task,
  isCompletedStyle = false,
  isHeldActive = false,
  modsFolder,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onOpenFolder,
  onHoverChange,
  onPopoverOpenChange,
}: DownloadRowProps) {
  const isDownloading = task.statusType === "downloading" && !isHeldActive
  const isPaused = task.statusType === "paused" && !isHeldActive
  const isPending = task.statusType === "pending" && !isHeldActive
  const isFailed = task.statusType === "failed" && !isHeldActive
  const isDone =
    isHeldActive ||
    task.statusType === "completed" ||
    task.statusType === "alreadyExists" ||
    task.statusType === "updated" ||
    task.statusType === "downgraded"

  const [imageError, setImageError] = React.useState(false)

  // 1. Column: Name & Metadata
  const renderNameColumn = () => (
    <div className="flex items-center gap-2.5 min-w-0 download-col-name overflow-hidden">
      {/* 32px Thumbnail */}
      <div className="size-8 rounded-md overflow-hidden bg-muted border border-border/60 shrink-0 flex items-center justify-center font-bold text-[10px] text-muted-foreground font-sans select-none">
        {task.thumbnail && !imageError ? (
          <img
            src={task.thumbnail}
            alt=""
            className="size-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          getInitials(task.title)
        )}
      </div>

      {/* Name, Version & Optional Second Line */}
      <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0 w-full">
          <span
            className="font-semibold text-xs text-foreground truncate font-sans min-w-0"
            aria-label={task.title}
          >
            {task.title}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
            v{task.version}
          </span>
        </div>

        {isFailed ? (
          <p
            className="text-[11px] text-destructive truncate font-sans min-w-0"
            aria-label={task.errorMessage || "Download interrupted"}
          >
            {task.errorMessage || "Download interrupted"}
          </p>
        ) : task.reason ? (
          <p
            className="text-[11px] text-muted-foreground truncate font-sans min-w-0"
            aria-label={task.reason}
          >
            {task.reason}
          </p>
        ) : null}
      </div>
    </div>
  )

  // 2. Column: Progress / Status
  const renderProgressColumn = () => (
    <div className="w-full max-w-[140px] flex items-center download-col-progress pr-3">
      {isDone ? (
        <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
          <CheckCircle2
            className={cn(
              "size-3.5 shrink-0",
              task.statusType === "downgraded"
                ? "text-amber-500"
                : task.statusType === "updated"
                ? "text-blue-500"
                : "text-emerald-500"
            )}
          />
          <span className="font-medium text-foreground">
            {task.statusType === "alreadyExists"
              ? "Already Installed"
              : task.statusType === "downgraded"
              ? "Downgraded"
              : task.statusType === "updated"
              ? "Updated"
              : "Completed"}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex items-center gap-1.5 text-xs font-sans text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="font-medium">Failed</span>
        </div>
      ) : isPaused ? (
        <div className="flex items-center gap-2 w-full">
          <div
            role="progressbar"
            aria-valuenow={task.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Paused download progress for ${task.title}`}
            className="h-1 flex-1 rounded-full overflow-hidden bg-muted/60 relative"
          >
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-200 ease-linear motion-reduce:transition-none"
              style={{ width: `${task.progressPercent ?? task.progress}%` }}
            />
          </div>
          <span className="text-xs font-sans font-medium tabular-nums text-amber-500 shrink-0 w-8 text-right">
            {task.progress}%
          </span>
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-2 w-full">
          <div
            role="progressbar"
            aria-valuenow={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Queued download for ${task.title}`}
            className="h-1 flex-1 rounded-full overflow-hidden bg-muted/60 relative"
          >
            <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: "0%" }} />
          </div>
          <span className="text-xs font-sans font-medium tabular-nums text-muted-foreground shrink-0 w-8 text-right">
            0%
          </span>
        </div>
      ) : (
        /* Downloading */
        <div className="flex items-center gap-2 w-full">
          <div
            role="progressbar"
            aria-valuenow={task.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Download progress for ${task.title}`}
            className="h-1 flex-1 rounded-full overflow-hidden bg-muted/60 relative"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear motion-reduce:transition-none"
              style={{ width: `${task.progressPercent ?? task.progress}%` }}
            />
          </div>
          <span className="text-xs font-sans font-medium tabular-nums text-foreground shrink-0 w-8 text-right">
            {task.progress}%
          </span>
        </div>
      )}
    </div>
  )

  // 3. Column: Size (104px, Right-aligned, Tabular-nums)
  const renderSizeColumn = () => {
    let sizeText = ""
    if (isDone) {
      sizeText = task.sizeMb > 0 ? `${task.sizeMb.toFixed(1)} MB` : "--"
    } else if (isDownloading || isPaused) {
      const totalStr = task.sizeMb > 0 ? `${task.sizeMb.toFixed(1)} MB` : "--"
      sizeText = `${task.downloadedMb.toFixed(1)} / ${totalStr}`
    } else if (isPending) {
      sizeText = task.sizeMb > 0 ? `${task.sizeMb.toFixed(1)} MB` : "--"
    } else if (isFailed) {
      sizeText = task.sizeMb > 0 ? `${task.sizeMb.toFixed(1)} MB` : "--"
    }

    return (
      <div className="w-[104px] text-right font-sans tabular-nums text-xs text-muted-foreground shrink-0 download-col-size whitespace-nowrap">
        {sizeText}
      </div>
    )
  }

  // 4. Column: Speed / Time (118px, Right-aligned, Tabular-nums)
  const renderSpeedTimeColumn = () => {
    let content: React.ReactNode = null

    if (isDone) {
      content = (
        <span className="text-muted-foreground text-xs font-sans tabular-nums">
          {formatRelativeTime(task.completedAt)}
        </span>
      )
    } else if (isPaused) {
      content = (
        <span className="text-amber-500 font-sans font-medium text-xs">
          Paused
        </span>
      )
    } else if (isPending) {
      content = (
        <span className="text-muted-foreground text-xs font-sans">
          {task.queuePosition ? `#${task.queuePosition} in line` : "Queued"}
        </span>
      )
    } else if (isFailed) {
      content = (
        <span className="text-destructive font-sans font-medium text-xs">
          Failed
        </span>
      )
    } else {
      // Active Downloading
      const speedPart = `${task.speed} MB/s`
      const cleanEta = cleanEtaString(task.etaFormatted)
      const etaPart = cleanEta ? ` · ${cleanEta}` : ""
      content = (
        <span className="text-muted-foreground text-xs font-sans tabular-nums whitespace-nowrap">
          {speedPart}
          {etaPart}
        </span>
      )
    }

    return (
      <div className="w-[144px] text-right shrink-0 download-col-speed flex items-center justify-end whitespace-nowrap overflow-hidden pl-1">
        {content}
      </div>
    )
  }

  // 5. Column: Actions Slot (Fixed width 76px, never shifts layout)
  const renderActionsColumn = () => {
    if (isDone && isCompletedStyle) {
      return (
        <div className="w-full flex items-center justify-end gap-1.5 shrink-0 justify-self-end ml-auto download-col-actions opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity">
          {/* Show in folder */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenFolder?.()
                  }}
                  aria-label={`Open folder for ${task.title}`}
                >
                  <Folder className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Show in folder</TooltipContent>
          </Tooltip>

          {/* Info Popover */}
          <DownloadInfoPopover
            task={task}
            modsFolder={modsFolder}
            onOpenFolder={onOpenFolder}
            onOpenChange={(open) => onPopoverOpenChange?.(task.rawId, open)}
          />

          {/* Remove from list */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove?.(task.rawId)
                  }}
                  aria-label={`Remove ${task.title} from list`}
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Remove from list</TooltipContent>
          </Tooltip>
        </div>
      )
    }

    if (isFailed) {
      return (
        <div className="w-full flex items-center justify-end gap-1.5 shrink-0 justify-self-end ml-auto download-col-actions">
          {/* Retry Button (with text + icon) */}
          <Button
            variant="outline"
            size="sm"
            className="h-[26px] px-2 text-[11px] gap-1 font-medium font-sans border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onRetry?.(task.rawId)
            }}
            aria-label={`Retry download for ${task.title}`}
          >
            <RotateCcw className="size-3" />
            <span>Retry</span>
          </Button>

          {/* Dismiss Icon */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove?.(task.rawId)
                  }}
                  aria-label={`Dismiss ${task.title}`}
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Dismiss</TooltipContent>
          </Tooltip>
        </div>
      )
    }

    if (isPaused) {
      return (
        <div className="w-full flex items-center justify-end gap-1.5 shrink-0 justify-self-end ml-auto download-col-actions">
          {/* Resume 26px button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onResume?.(task.rawId)
                  }}
                  aria-label={`Resume download for ${task.title}`}
                >
                  <Play className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Resume download</TooltipContent>
          </Tooltip>

          {/* Cancel 26px button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel?.(task.rawId)
                  }}
                  aria-label={`Cancel download for ${task.title}`}
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Cancel download</TooltipContent>
          </Tooltip>

          {/* Info popover 26px button */}
          <DownloadInfoPopover
            task={task}
            modsFolder={modsFolder}
            onOpenFolder={onOpenFolder}
            onOpenChange={(open) => onPopoverOpenChange?.(task.rawId, open)}
          />
        </div>
      )
    }

    if (isPending) {
      return (
        <div className="w-full flex items-center justify-end gap-1.5 shrink-0 justify-self-end ml-auto download-col-actions">
          {/* Start now button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRetry?.(task.rawId)
                  }}
                  aria-label={`Start download now for ${task.title}`}
                >
                  <Play className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Start now</TooltipContent>
          </Tooltip>

          {/* Cancel 26px button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel?.(task.rawId)
                  }}
                  aria-label={`Remove ${task.title} from queue`}
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top">Cancel download</TooltipContent>
          </Tooltip>

          {/* Info Popover */}
          <DownloadInfoPopover
            task={task}
            modsFolder={modsFolder}
            onOpenFolder={onOpenFolder}
            onOpenChange={(open) => onPopoverOpenChange?.(task.rawId, open)}
          />
        </div>
      )
    }

    /* Downloading */
    return (
      <div className="w-full flex items-center justify-end gap-1.5 shrink-0 justify-self-end ml-auto download-col-actions">
        {/* Pause 26px button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onPause?.(task.rawId)
                }}
                aria-label={`Pause download for ${task.title}`}
              >
                <Pause className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="top">Pause download</TooltipContent>
        </Tooltip>

        {/* Cancel 26px button */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-[26px] p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel?.(task.rawId)
                }}
                aria-label={`Cancel download for ${task.title}`}
              >
                <X className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="top">Cancel download</TooltipContent>
        </Tooltip>

        {/* Info popover 26px button */}
        <DownloadInfoPopover
          task={task}
          modsFolder={modsFolder}
          onOpenFolder={onOpenFolder}
          onOpenChange={(open) => onPopoverOpenChange?.(task.rawId, open)}
        />
      </div>
    )
  }

  const isCompletedRow = isDone && isCompletedStyle

  return (
    <div
      data-task-id={task.rawId}
      tabIndex={isCompletedRow ? 0 : undefined}
      onPointerEnter={() => onHoverChange?.(task.rawId, true)}
      onPointerLeave={() => onHoverChange?.(task.rawId, false)}
      className={cn(
        "group relative select-none transition-colors",
        isCompletedRow
          ? "h-11 min-h-[44px] hover:bg-muted/40 focus-visible:bg-muted/40 outline-none"
          : cn(
              "rounded-lg border bg-card transition-colors duration-150 min-h-[52px]",
              isFailed
                ? "border-destructive/40 bg-destructive/5"
                : isPaused
                ? "border-border/70 bg-card hover:border-border/90"
                : isHeldActive
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border/70 bg-card hover:border-border/90"
            )
      )}
    >
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(80px,140px)_104px_144px_auto] gap-x-4 pl-3.5 pr-2 py-2 items-center download-row-grid h-full w-full">
        {renderNameColumn()}
        {renderProgressColumn()}
        {renderSizeColumn()}
        {renderSpeedTimeColumn()}
        {renderActionsColumn()}
      </div>
    </div>
  )
}
