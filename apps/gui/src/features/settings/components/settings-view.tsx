"use client"

import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Palette,
  FolderCog,
  Sliders,
  Download,
  Info,
  FolderOpen,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Sun,
  Moon,
  Laptop,
  Settings,
  Heart,
  MessageSquare,
  FolderArchive,
} from "lucide-react"

import { cn, openExternalUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/components/layout/theme-provider"
import { FactorioVersionConfirmDialog } from "@/components/layout/factorio-version-confirm-dialog"
import {
  useSettingsStore,
  DEFAULT_FACTORIO_VERSIONS,
} from "@/stores/use-settings-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { isVersionNewer } from "@/lib/version-utils"

type SectionId = "appearance" | "folder" | "general" | "downloads" | "about"

interface SectionItem {
  id: SectionId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: SectionItem[] = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize theme and display preferences",
    icon: Palette,
  },
  {
    id: "folder",
    label: "Mods Directory",
    description: "Manage Factorio game mods folder location",
    icon: FolderCog,
  },
  {
    id: "general",
    label: "General",
    description: "Game version target and application behavior",
    icon: Sliders,
  },
  {
    id: "downloads",
    label: "Downloads & Network",
    description: "Concurrency, auto-retry, and mirror limits",
    icon: Download,
  },
  {
    id: "about",
    label: "About",
    description: "Version, license, and project information",
    icon: Info,
  },
]

export function SettingsView() {
  const [activeSection, setActiveSection] = React.useState<SectionId>("appearance")
  const { theme, setTheme } = useTheme()

  const {
    factorioVersion,
    setFactorioVersion,
    modsFolder,
    detectedFolder,
    setModsFolder,
    setThemeMode,
    maxConcurrency,
    setMaxConcurrency,
    autoRetry,
    setAutoRetry,
    autoCheckUpdates,
    setAutoCheckUpdates,
    timeoutGuard,
    setTimeoutGuard,
    configPath,
    openConfigFolder,
    resetToDefaults,
    loadSettings,
  } = useSettingsStore()

  const autoCascadeDependencies = useModManagerStore((s) => s.autoCascadeDependencies)
  const setAutoCascadeDependencies = useModManagerStore((s) => s.setAutoCascadeDependencies)
  const handleFactorioVersionChange = useModManagerStore((s) => s.handleFactorioVersionChange)

  const [folderStatus, setFolderStatus] = React.useState<"idle" | "saving" | "detecting">("idle")
  const [copied, setCopied] = React.useState(false)

  // Version change confirmation dialog state
  const [pendingVersion, setPendingVersion] = React.useState<string | null>(null)
  const [isConfirmingVersion, setIsConfirmingVersion] = React.useState(false)

  // Application update checking state
  const [appVersion, setAppVersion] = React.useState<string>("0.5.0")
  const [updateState, setUpdateState] = React.useState<{
    checking: boolean
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
    checked: boolean
  }>({
    checking: false,
    hasUpdate: false,
    checked: false,
  })

  // Determine if active mods folder matches the detected default
  const isDefaultFolder = React.useMemo(() => {
    if (!modsFolder || !detectedFolder) return false
    const normA = modsFolder.trim().replace(/[/\\]+/g, "/").toLowerCase()
    const normB = detectedFolder.trim().replace(/[/\\]+/g, "/").toLowerCase()
    return normA === normB
  }, [modsFolder, detectedFolder])

  // Load settings on mount
  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Check for app updates via GitHub API
  const checkForAppUpdates = React.useCallback(async () => {
    setUpdateState((prev) => ({ ...prev, checking: true }))
    try {
      let currentVer = "0.5.0"
      try {
        const { getVersion } = await import("@tauri-apps/api/app")
        currentVer = await getVersion()
      } catch {
        // browser fallback
      }
      setAppVersion(currentVer)

      const res = await fetch(
        "https://api.github.com/repos/vaibhavvikas/factorio-mod-downloader/releases/latest"
      )
      const data = await res.json()
      if (data && data.tag_name) {
        const tag = data.tag_name.startsWith("v")
          ? data.tag_name
          : `v${data.tag_name}`
        const hasUpdate = isVersionNewer(tag, currentVer)
        setUpdateState({
          checking: false,
          hasUpdate,
          latestVersion: tag,
          releaseUrl:
            data.html_url ||
            "https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest",
          checked: true,
        })
      } else {
        setUpdateState({ checking: false, hasUpdate: false, checked: true })
      }
    } catch (err) {
      console.error("Failed to check for updates:", err)
      setUpdateState({ checking: false, hasUpdate: false, checked: true })
    }
  }, [])

  // Auto-check for updates once on mount
  React.useEffect(() => {
    checkForAppUpdates()
  }, [checkForAppUpdates])

  // Action: Pick Folder via native OS dialog
  const handlePickFolder = async () => {
    try {
      setFolderStatus("saving")
      const picked = await invoke<string | null>("pick_mods_folder_dialog")
      if (picked) {
        await setModsFolder(picked)
      }
    } catch (err) {
      console.error("Failed to pick folder:", err)
    } finally {
      setFolderStatus("idle")
    }
  }

  // Action: Auto-detect default directory
  const handleDetectDefault = async () => {
    try {
      setFolderStatus("detecting")
      const detected = await invoke<string>("detect_default_mods_folder")
      if (detected) {
        await setModsFolder(detected)
      }
    } catch (err) {
      console.error("Failed to auto-detect mods folder:", err)
    } finally {
      setFolderStatus("idle")
    }
  }

  // Action: Open in Explorer / Finder
  const handleOpenExplorer = async () => {
    if (!modsFolder) return
    try {
      await invoke("open_folder_in_explorer", { path: modsFolder })
    } catch (err) {
      console.error("Failed to open folder:", err)
    }
  }

  // Action: Open Versions Cache Folder in Explorer / Finder
  const handleOpenVersionsFolder = async () => {
    if (!modsFolder) return
    try {
      await invoke("open_folder_in_explorer", {
        path: `${modsFolder}/.factorio-mod-downloader/versions`,
      })
    } catch (err) {
      console.error("Failed to open versions cache folder:", err)
    }
  }

  // Action: Copy folder path to clipboard
  const handleCopyPath = () => {
    if (!modsFolder) return
    navigator.clipboard.writeText(modsFolder)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConfirmVersionChange = async () => {
    const target = pendingVersion
    if (!target) return
    setIsConfirmingVersion(false)
    setPendingVersion(null)
    try {
      await setFactorioVersion(target)
      await handleFactorioVersionChange(target)
    } catch (e) {
      console.error("Failed to change Factorio version:", e)
    }
  }

  return (
    <div className="@container flex flex-col h-full w-full mx-auto font-sans">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Settings className="size-6 text-primary shrink-0" />
          <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Configure application preferences, theme appearance, and game folder paths.
        </p>
      </div>

      {/* Vertical Tabs Layout — fills remaining height and scrolls independently */}
      <div className="flex flex-1 min-h-0 gap-8 px-6 pb-6 pt-1">
        {/* Left Vertical Navigation — scrollable */}
        <ScrollArea className="w-56 shrink-0">
          <nav className="flex flex-col gap-1 pr-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors duration-150 cursor-pointer select-none border",
                    isActive
                      ? "bg-card text-foreground shadow-xs border-border"
                      : "border-transparent text-muted-foreground hover:bg-card/70 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="truncate">{section.label}</span>
                </button>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Right Content Area — scrollable */}
        <ScrollArea className="flex-1 min-w-0">
          <div className="space-y-6 pr-1">
            {/* SECTION: APPEARANCE */}
            {activeSection === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Theme &amp; Display</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select your interface color theme and visual preferences.
                  </p>
                </div>

                {/* Theme selector cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "dark", label: "Dark", icon: Moon, desc: "Default factorio theme" },
                    { id: "light", label: "Light", icon: Sun, desc: "High contrast daytime" },
                    { id: "system", label: "System", icon: Laptop, desc: "Match operating system" },
                  ].map((item) => {
                    const ItemIcon = item.icon
                    const isSelected = theme === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTheme(item.id as any)
                          setThemeMode(item.id as any)
                        }}
                        className={cn(
                          "flex flex-col items-start p-3.5 border text-left transition-all cursor-pointer select-none bg-card shadow-xs",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                            : "border-border hover:border-border/80 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div
                            className={cn(
                              "flex items-center justify-center size-8 rounded-lg",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <ItemIcon className="size-4" />
                          </div>
                          {isSelected && (
                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900">
                              Active
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SECTION: FOLDER LOCATION */}
            {activeSection === "folder" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Factorio Mods Directory</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The local directory where downloaded mod archives (<code className="text-primary font-mono text-[11px]">.zip</code>) are placed and scanned.
                  </p>
                </div>

                {/* Current path card */}
                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Target Folder Path
                      </span>
                      {modsFolder && (
                        isDefaultFolder ? (
                          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 select-none">
                            Detected
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900 select-none">
                            Custom
                          </Badge>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        value={modsFolder}
                        readOnly
                        className="font-mono text-xs h-9 bg-background select-all"
                        placeholder="No mods folder configured"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPath}
                        className="h-9 px-2.5 shrink-0 cursor-pointer"
                        aria-label="Copy path"
                      >
                        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                      </Button>
                    </div>

                    {/* Folder actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handlePickFolder}
                        disabled={folderStatus !== "idle"}
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        <FolderOpen className="size-3.5" />
                        <span>Browse Folder...</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDetectDefault}
                        disabled={folderStatus !== "idle"}
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        <RefreshCw className={cn("size-3.5", folderStatus === "detecting" && "animate-spin")} />
                        <span>Auto-Detect Default</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenExplorer}
                        disabled={!modsFolder}
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                        aria-label="Show active mods folder in file explorer"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>Show in Folder</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenVersionsFolder}
                        disabled={!modsFolder}
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                        aria-label="Open inactive versions cache folder in file explorer"
                      >
                        <FolderArchive className="size-3.5" />
                        <span>Open Inactive Versions Cache</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Information callout */}
                <div className="bg-card p-3.5 border border-border text-xs text-muted-foreground space-y-1 shadow-xs">
                  <span className="font-semibold text-foreground">Standard Factorio Paths:</span>
                  <ul className="list-disc list-inside space-y-0.5 pt-0.5 font-mono text-[11px]">
                    <li>Windows: <span className="text-foreground">%APPDATA%\Factorio\mods</span></li>
                    <li>macOS: <span className="text-foreground">~/Library/Application Support/factorio/mods</span></li>
                    <li>Linux: <span className="text-foreground">~/.factorio/mods</span></li>
                  </ul>
                </div>
              </div>
            )}

            {/* SECTION: GENERAL */}
            {activeSection === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">General Preferences</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Target game versions and application behavior.
                  </p>
                </div>

                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-4 pt-4">
                    {/* Factorio version select (Exact options as original GUI, wide popup without clipping) */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Target Factorio Version
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Filter portal releases and automatically restrict dependency versions in the queue.
                        </p>
                      </div>
                      <Select
                        value={factorioVersion}
                        onValueChange={(val) => {
                          if (!val || val === factorioVersion) return
                          setPendingVersion(val)
                          setIsConfirmingVersion(true)
                        }}
                      >
                        <SelectTrigger className="w-56 h-8 text-xs">
                          <SelectValue placeholder="Version" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64 min-w-(--anchor-width) w-auto">
                          {DEFAULT_FACTORIO_VERSIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs py-1.5 pl-2.5 pr-8">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Auto check updates */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Automatic Update Checking
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Check for newer mod versions when opening the explore view.
                        </p>
                      </div>

                      <Switch
                        checked={autoCheckUpdates}
                        onCheckedChange={setAutoCheckUpdates}
                      />
                    </div>

                    <Separator />

                    {/* Auto Cascade Dependencies */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Auto-manage Mod Dependencies
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically enable sub-dependencies when enabling a mod, and disable unneeded required dependencies when disabling.
                        </p>
                      </div>

                      <Switch
                        checked={autoCascadeDependencies}
                        onCheckedChange={setAutoCascadeDependencies}
                      />
                    </div>

                    <Separator />

                    {/* Configuration File & Storage */}
                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-sm font-medium text-foreground block">
                          Configuration File &amp; Storage
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          All preferences and window dimensions are persisted to your operating system profile.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 p-2.5 border border-border/80 bg-muted/40 font-mono text-xs">
                        <span className="truncate flex-1 text-muted-foreground select-all">
                          {configPath || "%APPDATA%\\factorio-mod-downloader\\config.json"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openConfigFolder}
                          className="h-8 text-xs gap-1.5 cursor-pointer font-sans"
                        >
                          <FolderOpen className="size-3.5" />
                          <span>Open Config Folder</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await resetToDefaults()
                            setTheme("system")
                            setThemeMode("system")
                          }}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-sans"
                        >
                          <span>Reset to Defaults</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SECTION: DOWNLOADS & NETWORK */}
            {activeSection === "downloads" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Downloads &amp; Network</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure multi-threaded download concurrency and retry policies.
                  </p>
                </div>

                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-4 pt-4">
                    {/* Concurrency limit */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Maximum Concurrent Downloads
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Number of parallel threads executing simultaneous mod downloads.
                        </p>
                      </div>
                      <Select value={maxConcurrency} onValueChange={(val) => val && setMaxConcurrency(val)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue placeholder="Threads" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 (Sequential)</SelectItem>
                          <SelectItem value="3">3 Parallel</SelectItem>
                          <SelectItem value="5">5 Parallel</SelectItem>
                          <SelectItem value="10">10 Parallel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Auto-retry */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Automatic 3-Attempt Network Retry
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically retry interrupted downloads up to 3 times before failing.
                        </p>
                      </div>
                      <Switch
                        checked={autoRetry}
                        onCheckedChange={setAutoRetry}
                      />
                    </div>

                    <Separator />

                    {/* Timeout guard */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                          Mirror Inactivity Timeout Guard
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Cancel and recycle requests stalled for more than 30 seconds.
                        </p>
                      </div>

                      <Switch
                        checked={timeoutGuard}
                        onCheckedChange={setTimeoutGuard}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SECTION: ABOUT */}
            {activeSection === "about" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Factorio Mod Downloader</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    High-performance native desktop client for Factorio mod exploration and batch downloading.
                  </p>
                </div>

                {/* Developer Profile Card */}
                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-11 rounded-full border border-border shadow-sm shrink-0">
                          <AvatarImage
                            src="https://github.com/vaibhavvikas.png"
                            alt="Vaibhav Vikas"
                          />
                          <AvatarFallback className="bg-gradient-to-tr from-blue-500 to-rose-500 text-white font-bold text-xs">
                            VV
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-sm text-foreground">
                              Vaibhav Vikas
                            </h4>
                            <Badge variant="secondary">
                              Creator
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            Factorio Mod Downloader Creator
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hey! I build open-source tools and utilities for gamers. If this tool helped sync your Factorio save sessions, consider starring the repo or supporting the project!
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                      {/* GitHub Sponsors Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300 transition-colors shrink-0"
                        onClick={() => openExternalUrl("https://github.com/sponsors/vaibhavvikas")}
                      >
                        <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                        <span>Sponsor</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => openExternalUrl("https://github.com/vaibhavvikas/factorio-mod-downloader")}
                      >
                        <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        <span>GitHub Repository</span>
                        <ExternalLink className="size-2.5 opacity-60" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => openExternalUrl("https://github.com/vaibhavvikas/factorio-mod-downloader/discussions")}
                      >
                        <MessageSquare className="size-3 text-blue-500" />
                        <span>Feedback &amp; Discussions</span>
                        <ExternalLink className="size-2.5 opacity-60" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Technical Stack & Software Updates Card */}
                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Desktop Frontend</span>
                        <span className="font-semibold text-foreground">Tauri v2 • React 19 • Tailwind CSS</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Core Engine</span>
                        <span className="font-semibold text-foreground">100% Native Rust</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Application Version</span>
                        <span className="font-semibold text-foreground">v{appVersion}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">License</span>
                        <span className="font-semibold text-foreground">MIT Open Source</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Software Update Checker */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-foreground block">
                          Software Updates
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {updateState.checking ? (
                            "Checking GitHub releases..."
                          ) : updateState.hasUpdate ? (
                            <span className="text-emerald-500 font-medium">
                              New version {updateState.latestVersion} is available!
                            </span>
                          ) : updateState.checked ? (
                            "You are on the latest version."
                          ) : (
                            "Check GitHub for newer releases."
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {updateState.hasUpdate ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() =>
                              openExternalUrl(
                                updateState.releaseUrl ||
                                "https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest"
                              )
                            }
                          >
                            <Download className="size-3.5" />
                            <span>Get {updateState.latestVersion}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateState.checking}
                            onClick={checkForAppUpdates}
                            className="h-8 text-xs gap-1.5 cursor-pointer font-sans"
                          >
                            <RefreshCw className={cn("size-3.5", updateState.checking && "animate-spin")} />
                            <span>{updateState.checking ? "Checking..." : "Check for Updates"}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Support Wube Card */}
                <Card className="bg-card shadow-xs border-border">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                          <Heart className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">Support Wube Software</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Don&apos;t have Factorio yet? Purchase and support the developers!
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Factorio is developed by Wube Software - an indie studio that has been building and improving the game for over a decade. Purchasing a legitimate copy directly supports their continued work.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                      {/* GitHub Sponsors Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium cursor-pointer border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300 transition-colors shrink-0"
                        onClick={() => openExternalUrl("https://www.factorio.com/buy")}
                      >
                        <ExternalLink className="size-3.5" />
                        <span>Buy Factorio</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Disclaimer */}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Factorio is a registered trademark of Wube Software. Factorio Mod Downloader is an independent open-source project and is not affiliated with or endorsed by Wube Software.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Version Change Confirmation Dialog */}
      <FactorioVersionConfirmDialog
        open={isConfirmingVersion}
        onOpenChange={(open) => {
          if (!open) setPendingVersion(null)
          setIsConfirmingVersion(open)
        }}
        fromVersion={factorioVersion}
        toVersion={pendingVersion || ""}
        onConfirm={handleConfirmVersionChange}
      />
    </div>
  )
}
