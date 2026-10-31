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
import { cn } from "@/lib/utils"
import { AppSidebar, type TabId } from "@/components/layout/app-sidebar"
import { StatusBar, type ActiveDownloadInfo } from "@/components/layout/status-bar"
import { ConsoleDrawer, type LogEntry } from "@/components/layout/console-drawer"
import { ExploreView } from "@/features/explore"
import { QueueView } from "@/features/queue"
import { DownloadsView } from "@/features/downloads"
import { SettingsView } from "@/features/settings"
import { ModManagerView } from "@/features/mod-manager"
import { CollectionsView } from "@/features/collections"
import { SetupDialog } from "@/components/layout/setup-dialog"
import { ParallaxBackground } from "@/components/layout/parallax-background"
import { useCollectionsStore } from "@/stores/use-collections-store"
import { useModQueueStore } from "@/stores/use-mod-queue-store"
import { useDownloadsStore } from "@/stores/use-downloads-store"
import { useApiStore } from "@/stores/use-api-store"
import { useSettingsStore } from "@/stores/use-settings-store"
import { isFactorioVersionCompatible } from "@/lib/version-utils"

export function AppLayout() {
  const [activeTab, setActiveTab] = React.useState<TabId>("explore")
  const [isConsoleOpen, setIsConsoleOpen] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const activeDownload = useDownloadsStore((s) => s.activeDownload)
  const factorioVersion = useSettingsStore((s) => s.factorioVersion)

  // Load settings on startup (detects mods folder, loads saved Factorio version)
  React.useEffect(() => {
    useSettingsStore.getState().loadSettings().then(() => {
      useCollectionsStore.getState().loadCollections()
    })
  }, [])

  // Start background poller for downloads
  React.useEffect(() => {
    const stop = useDownloadsStore.getState().startPolling()
    return stop
  }, [])

  // Start background poller for API connectivity health
  React.useEffect(() => {
    useApiStore.getState().startPolling()
    return () => useApiStore.getState().stopPolling()
  }, [])

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

  // Handle adding mod to queue from Explore cards
  const handleDownloadMod = React.useCallback(async (modName: string) => {
    appendLog("queue", "queue", `Adding "${modName}" to Mod Queue...`)

    try {
      const details = await invoke<any>("fetch_mod_details", { modId: modName })
      const currentFactorioVer = useSettingsStore.getState().factorioVersion
      const reversedReleases = (details.releases || []).slice().reverse()

      // Filter compatible releases for active factorio version
      const compatibleReleases = reversedReleases.filter((r: any) =>
        isFactorioVersionCompatible(r.factorio_version, currentFactorioVer)
      )

      const bestRelease =
        compatibleReleases.length > 0 ? compatibleReleases[0] : reversedReleases[0]
      const latestVersion = bestRelease?.version || "latest"
      const releaseDeps = bestRelease?.dependencies || details.default_dependencies || {
        required: [],
        recommended: [],
        optional: [],
        incompatible: [],
      }

      const treeNodes: any[] = []
      const mapDep = (dep: any, type: string) => ({
        id: `dep-${dep.id}-${Math.random()}`,
        name: String(dep.id),
        ineq: dep.ineq,
        version: String(dep.version || ""),
        type,
      })

      ;(releaseDeps.required || []).forEach((d: any) => treeNodes.push(mapDep(d, "required")))
      ;(releaseDeps.recommended || []).forEach((d: any) => treeNodes.push(mapDep(d, "recommended")))
      ;(releaseDeps.optional || []).forEach((d: any) => treeNodes.push(mapDep(d, "optional")))
      ;(releaseDeps.incompatible || []).forEach((d: any) => treeNodes.push(mapDep(d, "incompatible")))

      const { autoIncludeRecommended, autoIncludeOptional, addTargetMod } = useModQueueStore.getState()
      const initialSelectedIds = treeNodes
        .filter((d) => {
          if (d.type === "required") return true
          if (d.type === "recommended") return autoIncludeRecommended
          if (d.type === "optional") return autoIncludeOptional
          return false
        })
        .map((d) => d.id)

      addTargetMod({
        id: `mod-${Date.now()}-${Math.random()}`,
        name: details.name,
        title: details.title || details.name,
        author: details.owner || "Author",
        category: details.category || "content",
        summary: details.summary || "",
        thumbnail: details.thumbnail,
        updatedAt: details.updated_at,
        downloadsCount: details.downloads_count || 0,
        selectedVersion: latestVersion,
        availableReleases: reversedReleases,
        selectedDepIds: initialSelectedIds,
        dependencies: treeNodes,
      })

      appendLog("success", "queue", `Added "${details.title || details.name}" to Mod Queue`)
    } catch (err: any) {
      appendLog("error", "error", `Failed to add "${modName}" to queue: ${String(err)}`)
    }
  }, [appendLog])

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

          <SidebarInset className="relative flex flex-col flex-1 min-h-0 overflow-hidden border border-border/50 shadow-sm rounded-xl my-2 mr-2 ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0 bg-background">
            <ParallaxBackground />
            <header data-tauri-drag-region className="relative z-10 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 bg-background/80 backdrop-blur-md select-none">
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
                        {activeTab === "queue"
                          ? "Mod Queue"
                          : activeTab === "mods"
                          ? "Installed Mods"
                          : activeTab === "collections"
                          ? "Collections"
                          : activeTab === "downloads"
                          ? "Downloads"
                          : activeTab}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            {/* Settings View rendered without ScrollArea so no sidebar scrollbar is shown */}
            <div className={cn("relative z-[1] flex-1 min-h-0 h-full overflow-hidden", activeTab === "settings" ? "block" : "hidden")}>
              <SettingsView />
            </div>

            {/* Scrollable views */}
            <ScrollArea className={cn("relative z-[1] flex-1 min-h-0 h-full", activeTab === "settings" ? "hidden" : "block")}>
              <div className={activeTab === "explore" ? "block" : "hidden"}>
                <ExploreView
                  selectedVersion={factorioVersion}
                  onDownloadMod={handleDownloadMod}
                />
              </div>
              <div className={activeTab === "queue" ? "block" : "hidden"}>
                <QueueView
                  factorioVersion={factorioVersion}
                  onNavigateToExplore={() => setActiveTab("explore")}
                />
              </div>
              <div className={activeTab === "mods" ? "block" : "hidden"}>
                <ModManagerView isActive={activeTab === "mods"} />
              </div>
              <div className={activeTab === "collections" ? "block" : "hidden"}>
                <CollectionsView />
              </div>
              <div className={activeTab === "downloads" ? "block" : "hidden"}>
                <DownloadsView
                  isActive={activeTab === "downloads"}
                  onNavigateToQueue={() => setActiveTab("queue")}
                  onNavigateToExplore={() => setActiveTab("explore")}
                />
              </div>
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
      <SetupDialog />
    </div>
  )
}
