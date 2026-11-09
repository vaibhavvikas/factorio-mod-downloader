import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { parseDependencyString } from "@/features/mod-manager/grouping"
import type { CollectionProfile } from "@/features/collections/types"
import type { InstalledModGroup } from "@/features/mod-manager/types"
import { useModManagerStore } from "@/stores/use-mod-manager-store"

const STORAGE_KEY_ACTIVE_PROFILE = "fmd_active_profile_id"

export interface CollectionValidationError {
  modName: string
  modTitle: string
  message: string
}

/**
 * Validates candidate mods for saving into a collection.
 * Blocks saving if any mod has a missing child dependency or broken dependency tree.
 */
export function validateCollectionForSave(
  candidateModNames: string[],
  installedMods: InstalledModGroup[]
): { isValid: boolean; errors: CollectionValidationError[] } {
  const errors: CollectionValidationError[] = []
  const candidateSet = new Set(candidateModNames.map((n) => n.toLowerCase()))
  const installedMap = new Map((installedMods || []).map((m) => [m.name.toLowerCase(), m]))

  for (const name of candidateModNames) {
    if (!name || name.toLowerCase() === "base") continue
    const mod = installedMap.get(name.toLowerCase())
    if (!mod) continue

    // 1. Check known health issues on mod
    for (const issue of mod.healthIssues || []) {
      if (issue.kind === "missing_dep") {
        errors.push({
          modName: mod.name,
          modTitle: mod.title || mod.name,
          message: issue.message,
        })
      }
    }

    // 2. Check required dependencies
    for (const depStr of mod.dependencies || []) {
      const parsed = parseDependencyString(depStr)
      if (!parsed) continue

      if (parsed.type === "required") {
        const childMod = installedMap.get(parsed.id.toLowerCase())
        if (!childMod) {
          errors.push({
            modName: mod.name,
            modTitle: mod.title || mod.name,
            message: `Requires missing child dependency "${parsed.id}". Please install it before saving.`,
          })
        } else if (!candidateSet.has(parsed.id.toLowerCase())) {
          errors.push({
            modName: mod.name,
            modTitle: mod.title || mod.name,
            message: `Requires dependency "${childMod.title || parsed.id}", which is not included in this collection.`,
          })
        }
      } else if (parsed.type === "incompatible") {
        if (candidateSet.has(parsed.id.toLowerCase())) {
          errors.push({
            modName: mod.name,
            modTitle: mod.title || mod.name,
            message: `Incompatible with "${parsed.id}", which is also enabled in this collection.`,
          })
        }
      }
    }
  }

  // Deduplicate errors
  const seen = new Set<string>()
  const uniqueErrors = errors.filter((e) => {
    const key = `${e.modName}:${e.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    isValid: uniqueErrors.length === 0,
    errors: uniqueErrors,
  }
}

export function isProfileDirty(
  profile: CollectionProfile | null | undefined,
  installedMods: InstalledModGroup[] | null | undefined
): boolean {
  if (useCollectionsStore.getState().isApplyingProfile) {
    return false
  }
  if (!profile || !profile.mods || !Array.isArray(profile.mods) || !installedMods || !Array.isArray(installedMods) || installedMods.length === 0) {
    return false
  }

  const installedMap = new Map(installedMods.filter(Boolean).map((m) => [m.name, m.enabled]))
  const profileActiveModNames = new Set(
    profile.mods
      .filter((m) => m && m.name !== "base" && (m.enabled === undefined || m.enabled === true))
      .map((m) => m.name)
  )

  // 1. Any mod recorded in profile that is currently disabled in the game
  for (const modName of profileActiveModNames) {
    const isCurrentlyEnabled = installedMap.get(modName)
    if (!isCurrentlyEnabled) {
      return true
    }
  }

  // 2. Any installed non-virtual mod NOT in profile that is currently enabled in the game
  for (const mod of installedMods) {
    if (!mod || mod.isVirtual || mod.name === "base") continue
    if (mod.enabled && !profileActiveModNames.has(mod.name)) {
      return true
    }
  }

  return false
}

interface CollectionsStore {
  collections: CollectionProfile[]
  activeProfileId: string | null
  isLoading: boolean
  isApplyingProfile: boolean

  setActiveProfileId: (id: string | null) => void
  loadCollections: () => Promise<void>
  saveCollection: (profile: CollectionProfile, snapshotSettings: boolean) => Promise<CollectionProfile>
  updateProfileWithInstalledMods: (profileId: string, installedMods: InstalledModGroup[]) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  applyCollection: (id: string, disableOtherMods?: boolean) => Promise<void>
  exportCollectionJson: (id: string) => Promise<string>
  exportCollectionDialog: (id: string) => Promise<string | null>
  importCollectionFromJson: (jsonStr: string) => Promise<CollectionProfile>
  importCollectionDialog: () => Promise<CollectionProfile | null>
}

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  collections: [],
  activeProfileId:
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE) || "default"
      : "default",
  isLoading: false,
  isApplyingProfile: false,

  setActiveProfileId: (id: string | null) => {
    set({ activeProfileId: id })
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, id)
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_PROFILE)
      }
    }
  },

  loadCollections: async () => {
    set({ isLoading: true })
    try {
      const profiles = await invoke<CollectionProfile[]>("get_collections")
      let activeId = get().activeProfileId
      if (!activeId || !profiles.some((p) => p.id === activeId)) {
        const defaultProfile = profiles.find((p) => p.id === "default") || profiles[0]
        if (defaultProfile) {
          activeId = defaultProfile.id
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, activeId)
          }
        }
      }
      set({ collections: profiles, activeProfileId: activeId, isLoading: false })
    } catch (e) {
      console.error("Failed to load collections:", e)
      set({ isLoading: false })
    }
  },

  saveCollection: async (profile: CollectionProfile, snapshotSettings: boolean) => {
    // Only store active/enabled mods in the profile
    const activeMods = (profile.mods || [])
      .filter((m) => m && m.name !== "base" && (m.enabled === undefined || m.enabled === true))
      .map((m) => ({ ...m, enabled: true }))

    const sanitizedProfile: CollectionProfile = {
      ...profile,
      mods: activeMods,
    }

    const saved = await invoke<CollectionProfile>("save_collection", {
      profile: sanitizedProfile,
      snapshotSettings,
    })
    await get().loadCollections()
    return saved
  },

  updateProfileWithInstalledMods: async (profileId: string, installedMods: InstalledModGroup[]) => {
    const profile = get().collections.find((p) => p.id === profileId)
    if (!profile) return

    // Only save enabled mods! (Everything else will be automatically disabled)
    const enabledInstalled = (installedMods || []).filter((m) => m && m.enabled && m.name !== "base")

    // Validate for missing child dependencies
    const validation = validateCollectionForSave(
      enabledInstalled.map((m) => m.name),
      installedMods
    )
    if (!validation.isValid) {
      const msg = validation.errors.map((e) => `• ${e.modTitle}: ${e.message}`).join("\n")
      throw new Error(`Dependency errors:\n${msg}`)
    }

    const newMods = enabledInstalled.map((m) => ({
      name: m.name,
      enabled: true,
      version: m.activeVersion || "0.0.0",
    }))

    const updatedProfile: CollectionProfile = {
      ...profile,
      mods: newMods,
      updatedAt: new Date().toISOString(),
    }

    await get().saveCollection(updatedProfile, false)
  },

  deleteCollection: async (id: string) => {
    await invoke("delete_collection", { profileId: id })
    if (get().activeProfileId === id) {
      get().setActiveProfileId(null)
    }
    await get().loadCollections()
  },

  applyCollection: async (id: string, disableOtherMods: boolean = true) => {
    set({ isApplyingProfile: true })
    try {
      await invoke("apply_collection", { profileId: id, disableOtherMods })
      // 1. Reload installed mods first so the store reflects the new profile's mod states
      await useModManagerStore.getState().loadMods(true)
      // 2. Set the active profile ID now that installedMods matches it
      get().setActiveProfileId(id)
    } finally {
      // Yield slightly to ensure all react components settle with the new mods & active profile
      await new Promise((resolve) => setTimeout(resolve, 50))
      set({ isApplyingProfile: false })
    }
  },

  exportCollectionJson: async (id: string) => {
    return await invoke<string>("export_collection_json", { profileId: id })
  },

  exportCollectionDialog: async (id: string) => {
    return await invoke<string | null>("export_collection_dialog", { profileId: id })
  },

  importCollectionFromJson: async (jsonStr: string) => {
    const imported = await invoke<CollectionProfile>("import_collection_from_json", { jsonStr })
    await get().loadCollections()
    return imported
  },

  importCollectionDialog: async () => {
    const imported = await invoke<CollectionProfile | null>("import_collection_dialog")
    if (imported) {
      await get().loadCollections()
    }
    return imported
  },
}))
