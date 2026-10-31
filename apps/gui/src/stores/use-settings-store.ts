import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { useModQueueStore } from "./use-mod-queue-store"
import { useModManagerStore } from "./use-mod-manager-store"

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

export interface WindowStateData {
  width: number
  height: number
  is_maximized: boolean
  is_fullscreen: boolean
  x?: number | null
  y?: number | null
}

export interface AppConfigData {
  mods_folder?: string | null
  factorio_version?: string | null
  theme_mode?: string | null
  max_concurrency?: number | null
  auto_retry?: boolean | null
  auto_check_updates?: boolean | null
  timeout_guard?: boolean | null
  window_state?: WindowStateData | null
  setup_completed?: boolean | null
}

interface SettingsState {
  factorioVersion: string
  modsFolder: string
  detectedFolder: string
  themeMode: "light" | "dark" | "system"
  maxConcurrency: string
  autoRetry: boolean
  autoCheckUpdates: boolean
  timeoutGuard: boolean
  configPath: string
  setupCompleted: boolean
  isLoaded: boolean

  loadSettings: () => Promise<void>
  setFactorioVersion: (version: string) => Promise<void>
  setModsFolder: (folder: string) => Promise<void>
  setSetupCompleted: (completed: boolean) => Promise<void>
  setThemeMode: (mode: "light" | "dark" | "system") => Promise<void>
  setMaxConcurrency: (limit: string) => Promise<void>
  setAutoRetry: (retry: boolean) => Promise<void>
  setAutoCheckUpdates: (check: boolean) => Promise<void>
  setTimeoutGuard: (guard: boolean) => Promise<void>
  openConfigFolder: () => Promise<void>
  resetToDefaults: () => Promise<void>
  saveCurrentConfig: () => Promise<void>
}

// Window state is managed natively by tauri-plugin-window-state
export async function trackWindowState(): Promise<void> {}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  factorioVersion: "2.0",
  modsFolder: "",
  detectedFolder: "",
  themeMode: "system",
  maxConcurrency: "5",
  autoRetry: true,
  autoCheckUpdates: true,
  timeoutGuard: true,
  configPath: "",
  setupCompleted: true,
  isLoaded: false,

  saveCurrentConfig: async () => {
    const s = get()
    const payload: AppConfigData = {
      factorio_version: s.factorioVersion,
      mods_folder: s.modsFolder || null,
      theme_mode: s.themeMode,
      max_concurrency: parseInt(s.maxConcurrency, 10) || 5,
      auto_retry: s.autoRetry,
      auto_check_updates: s.autoCheckUpdates,
      timeout_guard: s.timeoutGuard,
      setup_completed: s.setupCompleted,
    }

    try {
      localStorage.setItem("factorio-config", JSON.stringify(payload))
      localStorage.setItem("factorio-theme", s.themeMode)
      if (s.setupCompleted) {
        localStorage.setItem("fmd_setup_completed", "true")
      }
      await invoke("save_app_config", { config: payload })
    } catch (err) {
      console.error("Failed to save app configuration:", err)
    }
  },

  loadSettings: async () => {
    if (get().isLoaded) return
    try {
      const [config, defaultFolder, configPath] = await Promise.all([
        invoke<AppConfigData>("get_app_config").catch(() => ({} as AppConfigData)),
        invoke<string>("detect_default_mods_folder").catch(() => ""),
        invoke<string>("get_config_path").catch(() => ""),
      ])

      const localTheme = (localStorage.getItem("factorio-theme") as "light" | "dark" | "system") || "system"
      const rawVer = config.factorio_version || "2.0"
      const finalVer = DEFAULT_FACTORIO_VERSIONS.some((v) => v.value === rawVer)
        ? rawVer
        : "2.0"

      const configSetupCompleted = config.setup_completed === true

      // If the backend config does not mark setup as complete (e.g. the config folder
      // was cleared or config is missing), drop any stale localStorage flag so the
      // setup dialog reappears and the user is asked for Factorio version + mods folder.
      if (!configSetupCompleted) {
        localStorage.removeItem("fmd_setup_completed")
      }

      const isSetupDone = configSetupCompleted

      set({
        factorioVersion: finalVer,
        modsFolder: config.mods_folder || defaultFolder || "",
        detectedFolder: defaultFolder || "",
        themeMode: (config.theme_mode as any) || localTheme,
        maxConcurrency: config.max_concurrency ? String(config.max_concurrency) : "5",
        autoRetry: config.auto_retry ?? true,
        autoCheckUpdates: config.auto_check_updates ?? true,
        timeoutGuard: config.timeout_guard ?? true,
        configPath: configPath || "",
        setupCompleted: isSetupDone,
        isLoaded: true,
      })

      // Update queued mods in Mod Queue based on the loaded Factorio version
      useModQueueStore.getState().updateAllModVersionsForFactorio(finalVer)

      // Start window state listener
      trackWindowState()
    } catch (err) {
      console.error("Failed to load settings:", err)
    }
  },

  setSetupCompleted: async (completed: boolean) => {
    set({ setupCompleted: completed })
    if (completed) {
      localStorage.setItem("fmd_setup_completed", "true")
    } else {
      localStorage.removeItem("fmd_setup_completed")
    }
    await get().saveCurrentConfig()
  },

  setFactorioVersion: async (version: string) => {
    const validVer = DEFAULT_FACTORIO_VERSIONS.some((v) => v.value === version)
      ? version
      : version || "2.0"

    set({ factorioVersion: validVer })
    await get().saveCurrentConfig()

    // Update queued mods in Mod Queue to select the latest release compatible with this Factorio version
    useModQueueStore.getState().updateAllModVersionsForFactorio(validVer)

    // Automatically disable incompatible installed mods and keep compatible ones enabled
    await useModManagerStore.getState().handleFactorioVersionChange(validVer)
  },

  setModsFolder: async (folder: string) => {
    set({ modsFolder: folder })
    await get().saveCurrentConfig()
  },

  setThemeMode: async (mode: "light" | "dark" | "system") => {
    set({ themeMode: mode })
    await get().saveCurrentConfig()
  },

  setMaxConcurrency: async (limit: string) => {
    set({ maxConcurrency: limit })
    await get().saveCurrentConfig()
  },

  setAutoRetry: async (retry: boolean) => {
    set({ autoRetry: retry })
    await get().saveCurrentConfig()
  },

  setAutoCheckUpdates: async (check: boolean) => {
    set({ autoCheckUpdates: check })
    await get().saveCurrentConfig()
  },

  setTimeoutGuard: async (guard: boolean) => {
    set({ timeoutGuard: guard })
    await get().saveCurrentConfig()
  },

  openConfigFolder: async () => {
    try {
      await invoke("open_config_folder")
    } catch (err) {
      console.error("Failed to open config folder:", err)
    }
  },

  resetToDefaults: async () => {
    try {
      const def = await invoke<AppConfigData>("reset_app_config")
      set({
        factorioVersion: def.factorio_version || "2.0",
        modsFolder: def.mods_folder || "",
        themeMode: "system",
        maxConcurrency: "5",
        autoRetry: true,
        autoCheckUpdates: true,
        timeoutGuard: true,
      })
      localStorage.removeItem("factorio-config")
      localStorage.setItem("factorio-theme", "system")
      useModQueueStore.getState().updateAllModVersionsForFactorio(def.factorio_version || "2.0")
    } catch (err) {
      console.error("Failed to reset config:", err)
    }
  },
}))
