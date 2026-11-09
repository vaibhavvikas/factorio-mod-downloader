import * as React from "react"
import {
  Download,
  Ban,
  Trash2,
  Folder,
  Inbox,
  ArrowRight,
  Package,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import type { FormattedDownloadTask, DownloadStatusType } from "../types"
import { DownloadRow } from "./download-row"

interface DownloadsViewProps {
  isActive?: boolean
  onNavigateToQueue?: () => void
  onNavigateToExplore?: () => void
}

/**
 * Throttle UI task updates to ~5 per second (every 200ms) for continuous progress/speed/size updates,
 * while applying immediate updates whenever tasks are added, removed, or their status changes.
 */
function useThrottledTasks(tasks: FormattedDownloadTask[], intervalMs = 200) {
  const [throttledTasks, setThrottledTasks] = React.useState<FormattedDownloadTask[]>(tasks)
  const lastUpdateRef = React.useRef(Date.now())
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSignatureRef = React.useRef("")

  const currentSignature = tasks.map((t) => `${t.rawId}:${t.statusType}`).join(",")

  React.useEffect(() => {
    // If task presence or status changed, update immediately
    if (currentSignature !== prevSignatureRef.current) {
      prevSignatureRef.current = currentSignature
      lastUpdateRef.current = Date.now()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setThrottledTasks(tasks)
      return
    }

    // Otherwise throttle progress/speed updates
    const now = Date.now()
    const remaining = intervalMs - (now - lastUpdateRef.current)
    if (remaining <= 0) {
      lastUpdateRef.current = now
      setThrottledTasks(tasks)
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now()
        setThrottledTasks(tasks)
      }, remaining)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [tasks, currentSignature, intervalMs])

  return throttledTasks
}

export function DownloadsView({
  isActive,
  onNavigateToQueue,
  onNavigateToExplore,
}: DownloadsViewProps) {
  const {
    tasks: rawTasks,
    activeCount,
    totalSpeed,
    overallProgress,
    overallProgressPercent,
    cancelTask,
    cancelAllTasks,
    togglePauseTask,
    retryTask,
    clearCompletedTasks,
    removeTask,
    startPolling,
  } = useDownloadsStore()

  const modsFolder = useSettingsStore((s) => s.modsFolder)

  // Throttle updates to ~5 per second
  const tasks = useThrottledTasks(rawTasks, 200)

  const [filter, setFilter] = React.useState<"all" | "active" | "completed" | "failed">("all")
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = React.useState<string>("")
  const [isCancelAllDialogOpen, setIsCancelAllDialogOpen] = React.useState(false)

  // Reset tab to "all" whenever switching to the downloads page
  React.useEffect(() => {
    if (isActive) {
      setFilter("all")
    }
  }, [isActive])

  // Tracking for row hover and popover open states to defer moving finished downloads
  const hoveredTaskIdsRef = React.useRef<Set<string>>(new Set())
  const openPopoverTaskIdsRef = React.useRef<Set<string>>(new Set())

  // Tasks that just finished and are held in place for ~1.2s with their success state
  const [heldFinishedTasks, setHeldFinishedTasks] = React.useState<Record<string, number>>({})
  const prevStatusesRef = React.useRef<Map<string, DownloadStatusType>>(new Map())

  // Start real-time polling
  React.useEffect(() => {
    const stop = startPolling()
    return stop
  }, [startPolling])

  // Detect newly finished or failed tasks
  React.useEffect(() => {
    const prevMap = prevStatusesRef.current
    const now = Date.now()

    tasks.forEach((task) => {
      const prevStatus = prevMap.get(task.rawId)
      const isNowDone =
        task.statusType === "completed" ||
        task.statusType === "alreadyExists" ||
        task.statusType === "updated" ||
        task.statusType === "downgraded"

      const wasActive =
        prevStatus === "downloading" ||
        prevStatus === "pending" ||
        prevStatus === "paused"

      const isNewlyArrivedDone =
        prevStatus === undefined &&
        isNowDone &&
        task.completedAt !== undefined &&
        now - task.completedAt < 2000

      // Newly completed download
      if ((wasActive || isNewlyArrivedDone) && isNowDone) {
        const actionLabel =
          task.statusType === "alreadyExists"
            ? "Already installed"
            : task.statusType === "downgraded"
              ? "Downgraded"
              : task.statusType === "updated"
                ? "Updated"
                : "Download completed"
        setAnnouncement(`${actionLabel}: ${task.title}`)
        setHeldFinishedTasks((prev) => ({
          ...prev,
          [task.rawId]: now,
        }))
      }

      // Newly failed download
      if (prevStatus && prevStatus !== "failed" && task.statusType === "failed") {
        setAnnouncement(`Download failed: ${task.title}. ${task.errorMessage || "Interrupted"}`)
      }

      prevMap.set(task.rawId, task.statusType)
    })
  }, [tasks])

  // Timer to check and release held finished downloads after ~1.2s, deferring if hovered or menu open
  const checkHeldTasks = React.useCallback(() => {
    setHeldFinishedTasks((prev) => {
      const now = Date.now()
      let hasChanges = false
      const next = { ...prev }

      Object.entries(prev).forEach(([taskId, finishedAt]) => {
        const isHovered = hoveredTaskIdsRef.current.has(taskId)
        const isMenuOpen = openPopoverTaskIdsRef.current.has(taskId)

        // Only release if at least 1200ms passed AND neither hovered nor menu open
        if (now - finishedAt >= 1200 && !isHovered && !isMenuOpen) {
          delete next[taskId]
          hasChanges = true
        }
      })

      return hasChanges ? next : prev
    })
  }, [])

  React.useEffect(() => {
    const interval = setInterval(checkHeldTasks, 150)
    return () => clearInterval(interval)
  }, [checkHeldTasks])

  const handleHoverChange = React.useCallback((taskId: string, isHovered: boolean) => {
    if (isHovered) {
      hoveredTaskIdsRef.current.add(taskId)
    } else {
      hoveredTaskIdsRef.current.delete(taskId)
      // When pointer leaves, release if duration passed
      checkHeldTasks()
    }
  }, [checkHeldTasks])

  const handlePopoverOpenChange = React.useCallback((taskId: string, isOpen: boolean) => {
    if (isOpen) {
      openPopoverTaskIdsRef.current.add(taskId)
    } else {
      openPopoverTaskIdsRef.current.delete(taskId)
      // When menu closes, release if duration passed
      checkHeldTasks()
    }
  }, [checkHeldTasks])

  const handleRemoveTask = React.useCallback(
    (rawId: string) => {
      setHeldFinishedTasks((prev) => {
        if (!prev[rawId]) return prev
        const next = { ...prev }
        delete next[rawId]
        return next
      })
      removeTask(rawId)
    },
    [removeTask]
  )

  // Categorize tasks
  // Active items include downloading, paused, queued, plus any currently held finished tasks
  const inProgressItems = React.useMemo(() => {
    return tasks
      .filter((t) => {
        const isHeld = !!heldFinishedTasks[t.rawId]
        if (isHeld) return true
        return (
          t.statusType === "downloading" ||
          t.statusType === "paused" ||
          t.statusType === "pending"
        )
      })
      .sort((a, b) => {
        const isHeldA = !!heldFinishedTasks[a.rawId]
        const isHeldB = !!heldFinishedTasks[b.rawId]

        const getRank = (t: FormattedDownloadTask, isHeld: boolean) => {
          if (isHeld) return 0
          if (t.statusType === "downloading") return 0
          if (t.statusType === "paused") return 1
          if (t.statusType === "pending") return 2
          return 0
        }

        const rankA = getRank(a, isHeldA)
        const rankB = getRank(b, isHeldB)
        if (rankA !== rankB) return rankA - rankB

        // Keep queue order (never sort live items by speed or progress)
        const posA = a.queuePosition ?? tasks.indexOf(a)
        const posB = b.queuePosition ?? tasks.indexOf(b)
        return posA - posB
      })
  }, [tasks, heldFinishedTasks])

  const failedItems = React.useMemo(() => {
    return tasks
      .filter((t) => t.statusType === "failed" && !heldFinishedTasks[t.rawId])
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  }, [tasks, heldFinishedTasks])

  const completedItems = React.useMemo(() => {
    return tasks
      .filter((t) => {
        if (heldFinishedTasks[t.rawId]) return false
        return (
          t.statusType === "completed" ||
          t.statusType === "alreadyExists" ||
          t.statusType === "updated" ||
          t.statusType === "downgraded"
        )
      })
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  }, [tasks, heldFinishedTasks])

  // Group completed items by install session
  const completedGroups = React.useMemo(() => {
    const groups: { name: string; items: FormattedDownloadTask[] }[] = []
    const groupMap = new Map<string, FormattedDownloadTask[]>()

    completedItems.forEach((item) => {
      const groupName = item.installGroup || "Direct Downloads"
      if (!groupMap.has(groupName)) {
        const list: FormattedDownloadTask[] = []
        groupMap.set(groupName, list)
        groups.push({ name: groupName, items: list })
      }
      groupMap.get(groupName)!.push(item)
    })

    return groups
  }, [completedItems])

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const handleOpenModsFolder = async () => {
    try {
      let folder: string | null = modsFolder || null
      if (!folder) {
        folder = await invoke<string | null>("get_mods_folder")
      }
      if (!folder) {
        folder = await invoke<string>("detect_default_mods_folder")
      }
      if (folder) {
        await invoke("open_folder_in_explorer", { path: folder })
      }
    } catch (err) {
      console.error("Failed to open mods folder:", err)
    }
  }

  const handleConfirmCancelAll = async () => {
    setIsCancelAllDialogOpen(false)
    await cancelAllTasks()
  }

  return (
    <div className="p-6 w-full space-y-6 downloads-container @container font-sans">
      {/* Polite Screen Reader Live Region for Accessibility */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Download className="size-6 text-primary shrink-0" />
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
              Download Manager
            </h2>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Track active transfers, retry interrupted downloads, and inspect package checksums.
          </p>

          {/* Overall Progress and Total Speed in Header while anything is running */}
          {activeCount > 0 && (
            <div className="flex items-center gap-3 pt-1.5 animate-in fade-in">
              <div
                role="progressbar"
                aria-valuenow={overallProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Overall download batch progress"
                className="h-1.5 w-40 sm:w-56 rounded-full overflow-hidden bg-muted relative"
              >
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: `${overallProgressPercent ?? overallProgress}%` }}
                />
              </div>
              <span className="text-xs font-sans text-muted-foreground tabular-nums flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{overallProgress}%</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-primary">
                  <Activity className="size-3" />
                  {totalSpeed} MB/s
                </span>
                <span>•</span>
                <span>{activeCount} active</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs Header */}
      <Tabs
        value={filter}
        onValueChange={(val: any) => setFilter(val)}
        className="w-full space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-2">
          <TabsList className="h-8 p-0.5 bg-muted/60 text-xs gap-1 select-none font-sans">
            <TabsTrigger value="all" className="text-xs h-7 px-3 cursor-pointer">
              <span>All</span>
              <span className="ml-1.5 text-[10px] font-mono px-1 rounded-sm bg-muted text-muted-foreground">
                {tasks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs h-7 px-3 cursor-pointer">
              <span>Active</span>
              {inProgressItems.length > 0 && (
                <span className="ml-1.5 text-[10px] font-mono px-1 rounded-sm bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
                  {inProgressItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs h-7 px-3 cursor-pointer">
              <span>Completed</span>
              {completedItems.length > 0 && (
                <span className="ml-1.5 text-[10px] font-mono px-1 rounded-sm bg-muted text-muted-foreground">
                  {completedItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs h-7 px-3 cursor-pointer">
              <span>Failed</span>
              {failedItems.length > 0 && (
                <span className="ml-1.5 text-[10px] font-mono px-1 rounded-sm bg-destructive/20 text-destructive font-bold">
                  {failedItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Action Buttons: Cancel All visually separated from Clear Completed & Open mods folder */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {inProgressItems.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCancelAllDialogOpen(true)}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer font-sans"
                >
                  <Ban className="size-3.5" />
                  <span>Cancel All</span>
                </Button>
                <Separator orientation="vertical" className="h-4 bg-border/60 mx-1 hidden sm:block" />
              </div>
            )}

            <div className="flex items-center gap-2">
              {completedItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompletedTasks}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-sans"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear Completed</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenModsFolder}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-sans"
              >
                <Folder className="size-3.5" />
                <span>Open mods folder</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="text-center py-16">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-semibold font-sans">
                Transfer queue is empty
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 font-sans">
                You have no active or completed downloads. Add mods to your queue and start downloading to monitor live transfers.
              </CardDescription>

              <div className="flex items-center justify-center gap-3 pt-4">
                {onNavigateToQueue && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onNavigateToQueue}
                    className="gap-2 text-xs font-medium cursor-pointer font-sans"
                  >
                    <Package className="size-3.5" />
                    <span>Go to Mod Queue</span>
                  </Button>
                )}
                {onNavigateToExplore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToExplore}
                    className="gap-2 text-xs font-medium cursor-pointer font-sans"
                  >
                    <span>Explore Mods</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* 1. In Progress Section */}
            {(filter === "all" || filter === "active") && inProgressItems.length > 0 && (
              <div className="space-y-2.5">
                {filter === "all" && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-muted-foreground font-sans">
                      In progress ({inProgressItems.length})
                    </h3>
                  </div>
                )}
                <div className="space-y-2">
                  {inProgressItems.map((task) => (
                    <DownloadRow
                      key={task.id}
                      task={task}
                      isHeldActive={!!heldFinishedTasks[task.rawId]}
                      modsFolder={modsFolder}
                      onPause={togglePauseTask}
                      onResume={togglePauseTask}
                      onCancel={cancelTask}
                      onRetry={retryTask}
                      onRemove={handleRemoveTask}
                      onOpenFolder={handleOpenModsFolder}
                      onHoverChange={handleHoverChange}
                      onPopoverOpenChange={handlePopoverOpenChange}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. Failed Section */}
            {(filter === "all" || filter === "failed") && failedItems.length > 0 && (
              <div className="space-y-2.5">
                {filter === "all" && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-destructive font-sans">
                      Failed ({failedItems.length})
                    </h3>
                  </div>
                )}
                <div className="space-y-2">
                  {failedItems.map((task) => (
                    <DownloadRow
                      key={task.id}
                      task={task}
                      modsFolder={modsFolder}
                      onRetry={retryTask}
                      onRemove={handleRemoveTask}
                      onOpenFolder={handleOpenModsFolder}
                      onHoverChange={handleHoverChange}
                      onPopoverOpenChange={handlePopoverOpenChange}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. Completed Section */}
            {(filter === "all" || filter === "completed") && completedItems.length > 0 && (
              <div className="space-y-4">
                {filter === "all" && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-muted-foreground font-sans">
                      Completed ({completedItems.length})
                    </h3>
                  </div>
                )}

                <div className="space-y-3">
                  {completedGroups.map((group) => {
                    const isMultiFile = group.items.length > 1
                    const isCollapsed = collapsedGroups[group.name]
                    const totalMb = group.items.reduce((acc, curr) => acc + curr.sizeMb, 0)
                    const latestTimestamp = Math.max(
                      ...group.items.map((i) => i.completedAt || 0)
                    )

                    // Single-file batches render as a plain row with NO group header
                    if (!isMultiFile) {
                      const singleItem = group.items[0]
                      return (
                        <div
                          key={singleItem.id}
                          className="rounded-lg border border-border/60 bg-card overflow-hidden"
                        >
                          <DownloadRow
                            task={singleItem}
                            isCompletedStyle={true}
                            modsFolder={modsFolder}
                            onRemove={handleRemoveTask}
                            onOpenFolder={handleOpenModsFolder}
                            onHoverChange={handleHoverChange}
                            onPopoverOpenChange={handlePopoverOpenChange}
                          />
                        </div>
                      )
                    }

                    // Multi-file batches render with collapsible group header
                    return (
                      <div
                        key={group.name}
                        className="rounded-lg border border-border/60 bg-card/60 overflow-hidden"
                      >
                        {/* Collapsible Group Header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.name)}
                          className="w-full h-9 px-3.5 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between text-xs font-sans text-muted-foreground cursor-pointer border-b border-border/40 select-none"
                        >
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-foreground">{group.name}</span>
                            <span>•</span>
                            <span className="text-muted-foreground font-normal">
                              {group.items.length} files
                            </span>
                            {totalMb > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-muted-foreground font-normal tabular-nums">
                                  {totalMb.toFixed(1)} MB
                                </span>
                              </>
                            )}
                          </div>

                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatRelativeTime(latestTimestamp)}
                          </span>
                        </button>

                        {/* Group Rows */}
                        {!isCollapsed && (
                          <div className="divide-y divide-border/30">
                            {group.items.map((item) => (
                              <DownloadRow
                                key={item.id}
                                task={item}
                                isCompletedStyle={true}
                                modsFolder={modsFolder}
                                onRemove={handleRemoveTask}
                                onOpenFolder={handleOpenModsFolder}
                                onHoverChange={handleHoverChange}
                                onPopoverOpenChange={handlePopoverOpenChange}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty filter result fallback */}
            {filter === "active" && inProgressItems.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground italic font-sans">
                No active downloads.
              </div>
            )}
            {filter === "completed" && completedItems.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground italic font-sans">
                No completed downloads.
              </div>
            )}
            {filter === "failed" && failedItems.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground italic font-sans">
                No failed downloads.
              </div>
            )}
          </div>
        )}
      </Tabs>

      {/* Cancel All Confirmation Dialog */}
      <Dialog open={isCancelAllDialogOpen} onOpenChange={setIsCancelAllDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel active downloads?</DialogTitle>
            <DialogDescription>
              Cancel {inProgressItems.length} active{" "}
              {inProgressItems.length === 1 ? "download" : "downloads"}? Partial progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelAllDialogOpen(false)}
              className="text-xs font-sans cursor-pointer"
            >
              Keep downloading
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancelAll}
              className="text-xs font-sans cursor-pointer"
            >
              Cancel downloads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
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
