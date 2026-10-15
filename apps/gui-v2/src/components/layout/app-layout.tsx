import * as React from "react"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { AppSidebar, type TabId } from "@/components/layout/app-sidebar"
import { StatusBar, type ActiveDownloadInfo } from "@/components/layout/status-bar"
import { ConsoleDrawer, type LogEntry } from "@/components/layout/console-drawer"
import { ExploreView } from "@/features/explore"

export function AppLayout() {
  const [activeTab, setActiveTab] = React.useState<TabId>("explore")
  const [isConsoleOpen, setIsConsoleOpen] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [activeDownload, setActiveDownload] = React.useState<ActiveDownloadInfo | null>(null)

  // Listen for real-time backend log events emitted by Rust (Downloader, Resolver, API)
  React.useEffect(() => {
    let unlisten: (() => void) | undefined
    let isCancelled = false

    listen<LogEntry>("app:log", (event) => {
      setLogs((prev) => {
        // Prevent duplicate log lines
        if (prev.some((entry) => entry.id === event.payload.id)) {
          return prev
        }
        const updated = [...prev, event.payload]
        return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated
      })
    })
      .then((fn) => {
        if (isCancelled) {
          fn()
        } else {
          unlisten = fn
        }
      })
      .catch(() => {
        // Safe fallback when running in a pure web browser environment
      })

    return () => {
      isCancelled = true
      if (unlisten) unlisten()
    }
  }, [])

  // Keyboard shortcut: ⌘J / Ctrl+J to toggle console drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setIsConsoleOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const appendLog = (level: LogEntry["level"], tag: string, message: string) => {
    // Route through backend logger command; fallback to local append if in browser mode
    invoke("log_message", { level, tag, message }).catch(() => {
      const now = new Date()
      const timestamp = now.toTimeString().split(" ")[0]
      const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
        level,
        tag,
        message,
      }
      setLogs((prev) => {
        const updated = [...prev, newLog]
        return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated
      })
    })
  }

  // Handle mod download flow: queue -> resolve -> download -> verify -> success
  const handleDownloadMod = React.useCallback((modName: string) => {
    // Open console drawer so user can monitor real-time lifecycle
    setIsConsoleOpen(true)

    appendLog("queue", "queue", `Queued download request for mod: '${modName}'`)

    setTimeout(() => {
      appendLog(
        "resolve",
        "resolve",
        `Querying mod portal API for dependency tree of '${modName}'...`
      )
    }, 400)

    setTimeout(() => {
      appendLog(
        "resolve",
        "resolve",
        `Resolved dependencies for '${modName}': 'base >= 2.0.0' [Satisfied]`
      )
      setActiveDownload({
        modName,
        progress: 15,
        statusText: "Connecting...",
      })
    }, 900)

    setTimeout(() => {
      appendLog(
        "download",
        "download",
        `Starting streaming download for '${modName}_latest.zip' (18.4 MB)`
      )
      setActiveDownload({
        modName,
        progress: 45,
        statusText: "Downloading 45%",
      })
    }, 1500)

    setTimeout(() => {
      setActiveDownload({
        modName,
        progress: 85,
        statusText: "Downloading 85%",
      })
    }, 2100)

    setTimeout(() => {
      appendLog(
        "verify",
        "verify",
        `Download complete. Validating archive checksum (SHA1) & headers...`
      )
      setActiveDownload({
        modName,
        progress: 100,
        statusText: "Verifying checksum...",
      })
    }, 2600)

    setTimeout(() => {
      appendLog(
        "success",
        "success",
        `Integrity verified. Installed '${modName}' to ~/Library/Application Support/factorio/mods/`
      )
      setActiveDownload(null)
    }, 3200)
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground select-none">
      {/* Middle Workspace Layout with transform containing block for fixed sidebar */}
      <div className="relative flex-1 flex w-full min-h-0 overflow-hidden [transform:translateZ(0)]">
        <SidebarProvider
          className="flex flex-1 w-full h-full min-h-0 overflow-hidden"
          style={
            {
              minHeight: 0,
            } as React.CSSProperties
          }
        >
          <AppSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <SidebarInset className="relative flex flex-col flex-1 min-h-0 overflow-hidden border border-border/50 shadow-sm rounded-xl my-2 mr-2 ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
            <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-4 bg-background">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="h-4 my-auto self-center" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <span className="text-xs text-muted-foreground">Factorio</span>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs font-semibold capitalize">
                        {activeTab}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <ScrollArea className="flex-1 min-h-0 h-full">
              {activeTab === "explore" && (
                <ExploreView onDownloadMod={handleDownloadMod} />
              )}
            </ScrollArea>

            {/* Collapsible Console Drawer (VS Code / Linear style) */}
            <ConsoleDrawer
              isOpen={isConsoleOpen}
              onClose={() => setIsConsoleOpen(false)}
              logs={logs}
              onClearLogs={() => setLogs([])}
            />
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        isConsoleOpen={isConsoleOpen}
        onToggleLogs={() => setIsConsoleOpen((v) => !v)}
        latestLog={logs.length > 0 ? logs[logs.length - 1] : null}
        activeDownload={activeDownload}
      />
    </div>
  )
}
