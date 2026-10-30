import * as React from "react"
import {
  Terminal,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn, getShortcutLabel } from "@/lib/utils"

export type LogLevel =
  | "system"
  | "info"
  | "warn"
  | "queue"
  | "resolve"
  | "download"
  | "verify"
  | "success"
  | "error"

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  tag: string
  message: string
}

interface ConsoleDrawerProps {
  isOpen: boolean
  onClose: () => void
  logs: LogEntry[]
  onClearLogs: () => void
}

const DEFAULT_STREAMING_LIMIT = 100

function toTitleCase(str: string): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function ConsoleDrawer({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}: ConsoleDrawerProps) {
  const [activeFilter, setActiveFilter] = React.useState<"all" | "downloads" | "resolve" | "system">("all")
  const [visibleLimit, setVisibleLimit] = React.useState<number>(DEFAULT_STREAMING_LIMIT)
  const logContainerRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll strictly inside the log container (never scrolls window/parent)
  React.useEffect(() => {
    if (isOpen && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isOpen])

  const filteredLogs = React.useMemo(() => {
    if (activeFilter === "all") return logs
    if (activeFilter === "downloads") {
      return logs.filter((l) =>
        ["queue", "download", "verify", "success"].includes(l.level)
      )
    }
    if (activeFilter === "resolve") {
      return logs.filter((l) => l.level === "resolve")
    }
    if (activeFilter === "system") {
      return logs.filter((l) => ["system", "info", "error"].includes(l.level))
    }
    return logs
  }, [logs, activeFilter])

  // Sliding window: only keep and render the latest `visibleLimit` lines in DOM
  const displayedLogs = React.useMemo(() => {
    if (filteredLogs.length <= visibleLimit) return filteredLogs
    return filteredLogs.slice(filteredLogs.length - visibleLimit)
  }, [filteredLogs, visibleLimit])

  const olderCount = filteredLogs.length - displayedLogs.length

  // Infinite scroll up to dynamically load older logs
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && olderCount > 0) {
      const prevScrollHeight = e.currentTarget.scrollHeight
      setVisibleLimit((prev) => Math.min(prev + 100, filteredLogs.length))
      // Maintain scroll position after prepending items
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          const newScrollHeight = logContainerRef.current.scrollHeight
          logContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight
        }
      })
    }
  }

  const getBadgeStyle = (level: LogLevel) => {
    switch (level) {
      case "system":
      case "info":
        return "text-sky-400 bg-sky-950/40 border-sky-800/40"
      case "warn":
      case "queue":
        return "text-amber-400 bg-amber-950/40 border-amber-800/40"
      case "resolve":
        return "text-purple-400 bg-purple-950/40 border-purple-800/40"
      case "download":
        return "text-cyan-400 bg-cyan-950/40 border-cyan-800/40"
      case "verify":
        return "text-indigo-400 bg-indigo-950/40 border-indigo-800/40"
      case "success":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
      case "error":
        return "text-rose-400 bg-rose-950/40 border-rose-800/40"
      default:
        return "text-zinc-400 bg-zinc-900 border-zinc-800"
    }
  }

  return (
    <div
      className={cn(
        "shrink-0 flex flex-col border-t border-border bg-zinc-950 text-zinc-100 dark:bg-zinc-950 transition-all duration-200 ease-in-out overflow-hidden z-20",
        isOpen
          ? "h-[240px] opacity-100 pointer-events-auto"
          : "h-0 opacity-0 border-t-0 pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      {/* Console Header - clean, no separators */}
      <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-zinc-800 bg-zinc-900 select-none">
        {/* Left: Terminal Title & Filter Tabs */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-zinc-100 font-mono text-xs font-semibold mr-1">
            <Terminal className="size-3.5 text-primary" />
            <span>Output</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1">
            {(
              [
                { id: "all", label: "All Logs" },
                { id: "downloads", label: "Downloads" },
                { id: "resolve", label: "Resolution" },
                { id: "system", label: "System" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveFilter(tab.id)
                  setVisibleLimit(DEFAULT_STREAMING_LIMIT)
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                  activeFilter === tab.id
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Live streaming telemetry indicator */}
          <div className="hidden sm:flex items-center gap-1.5 ml-2 text-[10px] font-mono text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Streaming</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Clear Logs */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onClearLogs}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 cursor-pointer"
                  aria-label="Clear Console"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top" className="text-xs">
              Clear Console
            </TooltipContent>
          </Tooltip>

          {/* Close Console (X button) - right aligned */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onClose}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 cursor-pointer"
                  aria-label="Close Console"
                >
                  <X className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="top" className="flex items-center gap-1.5 text-xs">
              <span>Close Console</span>
              <kbd
                data-slot="kbd"
                className="inline-flex items-center justify-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-background/20 text-background border border-background/25 font-semibold leading-none"
              >
                {getShortcutLabel("J")}
              </kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Console Log Area with streaming window & dynamic older logs loading */}
      <ScrollArea
        viewportRef={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 bg-zinc-950 text-zinc-300 select-text"
        viewportClassName="p-2.5 font-mono text-[11px] space-y-1 select-text"
        scrollBarClassName="bg-zinc-900/30"
        thumbClassName="bg-zinc-700/60 hover:bg-zinc-500"
      >
        {/* Dynamic loader banner when logs exceed window */}
        {olderCount > 0 && (
          <div className="sticky top-0 z-10 py-1 px-2.5 mb-1.5 rounded border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-400 flex items-center justify-between shadow-xs">
            <span>
              Streaming latest <strong className="text-zinc-200">{displayedLogs.length}</strong> of{" "}
              <strong className="text-zinc-200">{filteredLogs.length}</strong> lines
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 100)}
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                Load older ({Math.min(100, olderCount)} more)
              </button>
              <span className="text-zinc-600">•</span>
              <button
                type="button"
                onClick={() => setVisibleLimit(filteredLogs.length)}
                className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Show all
              </button>
            </div>
          </div>
        )}

        {displayedLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 italic select-none py-8">
            No console output for filter '{activeFilter}'.
          </div>
        ) : (
          displayedLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 leading-relaxed hover:bg-zinc-900/60 px-1.5 py-0.5 rounded transition-colors group"
            >
              <span className="text-zinc-500 shrink-0 select-none">
                {log.timestamp}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded border text-[10px] font-semibold tracking-normal shrink-0 select-none",
                  getBadgeStyle(log.level)
                )}
              >
                {toTitleCase(log.tag)}
              </span>
              <span className="text-zinc-200 break-all flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  )
}
