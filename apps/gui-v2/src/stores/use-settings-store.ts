import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { useModQueueStore } from "./use-mod-queue-store"

export interface FactorioVersionOption {
  value: string
  label: string
  shortLabel: string
}

export const DEFAULT_FACTORIO_VERSIONS: FactorioVersionOption[] = [
  { value: "2.1", label: "Factorio 2.1", shortLabel: "v2.1" },
  { value: "2.0", label: "Factorio 2.0", shortLabel: "v2.0" },
  { value: "1.1", label: "Factorio 1.1", shortLabel: "v1.1" },
  { value: "1.0", label: "Factorio 1.0", shortLabel: "v1.0" },
  { value: "any", label: "Any Version", shortLabel: "Any" },
]

interface SettingsState {
  factorioVersion: string
  modsFolder: string
  detectedFolder: string
  isLoaded: boolean

  loadSettings: () => Promise<void>
  setFactorioVersion: (version: string) => Promise<void>
  setModsFolder: (folder: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  factorioVersion: "2.1",
  modsFolder: "",
  detectedFolder: "",
  isLoaded: false,

  loadSettings: async () => {
    try {
      const [savedVer, savedFolder, defaultFolder] = await Promise.all([
        invoke<string>("get_factorio_version").catch(() => "2.1"),
        invoke<string | null>("get_mods_folder").catch(() => null),
        invoke<string>("detect_default_mods_folder").catch(() => ""),
      ])

      const finalVer = DEFAULT_FACTORIO_VERSIONS.some((v) => v.value === savedVer)
        ? savedVer
        : savedVer || "2.1"

      set({
        factorioVersion: finalVer,
        modsFolder: savedFolder || defaultFolder || "",
        detectedFolder: defaultFolder || "",
        isLoaded: true,
      })

      // Update queued mods in Mod Queue based on the loaded Factorio version
      useModQueueStore.getState().updateAllModVersionsForFactorio(finalVer)
    } catch (err) {
      console.error("Failed to load settings:", err)
    }
  },

  setFactorioVersion: async (version: string) => {
    const validVer = DEFAULT_FACTORIO_VERSIONS.some((v) => v.value === version)
      ? version
      : version || "2.1"

    set({ factorioVersion: validVer })

    try {
      await invoke("save_factorio_version", { version: validVer })
    } catch (err) {
      console.error("Failed to save factorio version:", err)
    }

    // Update queued mods in Mod Queue to select the latest release compatible with this Factorio version
    useModQueueStore.getState().updateAllModVersionsForFactorio(validVer)
  },

  setModsFolder: async (folder: string) => {
    set({ modsFolder: folder })
    try {
      await invoke("save_mods_folder", { path: folder })
    } catch (err) {
      console.error("Failed to save mods folder:", err)
    }
  },
}))
