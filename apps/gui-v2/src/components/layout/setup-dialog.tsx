import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { FolderOpen, RefreshCw, CheckCircle2, Gamepad2, FolderCode } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  useSettingsStore,
  DEFAULT_FACTORIO_VERSIONS,
} from "@/stores/use-settings-store"
import { useCollectionsStore } from "@/stores/use-collections-store"
import { useModManagerStore } from "@/stores/use-mod-manager-store"
import { cn } from "@/lib/utils"

export function SetupDialog() {
  const isLoaded = useSettingsStore((s) => s.isLoaded)
  const setupCompleted = useSettingsStore((s) => s.setupCompleted)
  const factorioVersion = useSettingsStore((s) => s.factorioVersion)
  const modsFolder = useSettingsStore((s) => s.modsFolder)
  const detectedFolder = useSettingsStore((s) => s.detectedFolder)
  const setFactorioVersion = useSettingsStore((s) => s.setFactorioVersion)
  const setModsFolder = useSettingsStore((s) => s.setModsFolder)
  const setSetupCompleted = useSettingsStore((s) => s.setSetupCompleted)

  const [selectedVersion, setSelectedVersion] = React.useState<string>("2.0")
  const [folderPath, setFolderPath] = React.useState<string>("")
  const [isDetecting, setIsDetecting] = React.useState(false)
  const [isBrowsing, setIsBrowsing] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Initialize values once settings are loaded
  React.useEffect(() => {
    if (isLoaded) {
      setSelectedVersion(factorioVersion || "2.0")
      setFolderPath(modsFolder || detectedFolder || "")
    }
  }, [isLoaded, factorioVersion, modsFolder, detectedFolder])

  const isOpen = isLoaded && !setupCompleted

  const handleBrowseFolder = async () => {
    setIsBrowsing(true)
    try {
      const picked = await invoke<string | null>("pick_mods_folder_dialog")
      if (picked) {
        setFolderPath(picked)
      }
    } catch (e) {
      console.error("Failed to browse mods folder:", e)
    } finally {
      setIsBrowsing(false)
    }
  }

  const handleAutoDetect = async () => {
    setIsDetecting(true)
    try {
      const detected = await invoke<string>("detect_default_mods_folder")
      if (detected) {
        setFolderPath(detected)
      }
    } catch (e) {
      console.error("Failed to detect mods folder:", e)
    } finally {
      setIsDetecting(false)
    }
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await setFactorioVersion(selectedVersion)
      if (folderPath) {
        await setModsFolder(folderPath)
      }
      await setSetupCompleted(true)

      // Initialize collections and mod manager
      await useCollectionsStore.getState().loadCollections()

      // Ensure default collection profile's factorio version is set to user-selected version
      const collections = useCollectionsStore.getState().collections
      const defaultProf = collections.find((c) => c.id === "default")
      if (defaultProf && defaultProf.factorioVersion !== selectedVersion) {
        await useCollectionsStore.getState().saveCollection(
          { ...defaultProf, factorioVersion: selectedVersion, factorio_version: selectedVersion },
          false
        )
        await useCollectionsStore.getState().loadCollections()
      }

      await useModManagerStore.getState().loadMods()
    } catch (e) {
      console.error("Failed to save initial setup:", e)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Welcome to Factorio Mod Downloader</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up your default Factorio version and mods directory to get started.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Factorio Version Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Default Factorio Version</span>
            </Label>
            <Select
              value={selectedVersion}
              onValueChange={(val) => val && setSelectedVersion(val)}
            >
              <SelectTrigger aria-label="Select default Factorio version" className="w-full h-9 text-xs">
                <SelectValue placeholder="Select Factorio version" />
              </SelectTrigger>
              <SelectContent className="w-full">
                {DEFAULT_FACTORIO_VERSIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs py-2">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Choose the Factorio version you are currently playing. Mod search and compatibility filters will adapt to this.
            </p>
          </div>

          {/* Factorio Mods Directory Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FolderCode className="size-3.5 text-muted-foreground" />
              <span>Factorio Mods Directory</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="e.g. C:\Users\...\AppData\Roaming\Factorio\mods"
                className="font-mono text-xs h-9 bg-background flex-1"
                aria-label="Factorio mods folder path"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowseFolder}
                disabled={isBrowsing}
                className="h-9 gap-1.5 text-xs px-3 shrink-0 cursor-pointer"
                aria-label="Browse for mods folder"
              >
                <FolderOpen className="size-3.5" />
                <span>Browse</span>
              </Button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Where Factorio looks for installed .zip mods.</span>
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer"
                aria-label="Auto-detect default mods folder"
              >
                <RefreshCw className={cn("size-3", isDetecting && "animate-spin")} />
                <span>Auto-detect</span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 pt-2 border-t border-border/60">
          <Button
            variant="default"
            size="default"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-9 text-xs font-semibold gap-1.5 cursor-pointer ml-auto"
            aria-label="Confirm initial setup and continue"
          >
            <CheckCircle2 className="size-4" />
            <span>Get Started</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

