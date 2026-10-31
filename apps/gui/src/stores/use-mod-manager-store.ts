import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { InstalledModGroup, ModGroupGraph, StorageUsage } from "@/features/mod-manager/types"
import { parseDependencyString } from "@/features/mod-manager/grouping"
import { isFactorioVersionCompatible } from "@/lib/version-utils"
import { useDownloadsStore } from "./use-downloads-store"
import { useSettingsStore } from "./use-settings-store"

export type ModFilterTab = "all" | "enabled" | "disabled" | "updates" | "attention"

const STORAGE_KEY_CASCADE = "fmd_auto_cascade_dependencies"
const CORE_MODS = new Set(["base", "space-age", "quality", "elevated-rails", "recycler"])

/**
 * Calculates cascading updates when enabling or disabling a mod.
 * - Enabling: auto-enables all required sub-dependencies recursively.
 * - Disabling: auto-disables required sub-dependencies as long as they are NOT required by another enabled mod.
 */
export function calculateCascadeUpdates(
  targetModName: string,
  targetEnabled: boolean,
  allMods: InstalledModGroup[]
): Array<[string, boolean]> {
  const modMap = new Map<string, InstalledModGroup>()
  allMods.forEach((m) => modMap.set(m.name, m))

  const target = modMap.get(targetModName)
  if (!target || CORE_MODS.has(targetModName)) {
    return [[targetModName, targetEnabled]]
  }

  // 1. Enabling: auto-enable all required sub-dependencies recursively
  if (targetEnabled) {
    const toEnable = new Set<string>([targetModName])
    const queue = [target]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (!current.dependencies) continue

      for (const depStr of current.dependencies) {
        const parsed = parseDependencyString(depStr)
        if (!parsed || parsed.type !== "required" || CORE_MODS.has(parsed.id)) {
          continue
        }

        const child = modMap.get(parsed.id)
        if (child && !child.enabled && !toEnable.has(child.name)) {
          toEnable.add(child.name)
          queue.push(child)
        }
      }
    }

    return Array.from(toEnable).map((name) => [name, true])
  }

  // 2. Disabling: auto-disable all required sub-dependencies as long as they are not required somewhere else
  const toDisable = new Set<string>([targetModName])
  let addedMore = true

  while (addedMore) {
    addedMore = false

    // Identify candidate sub-deps from all currently marked-as-disabled mods
    const candidates = new Set<string>()
    for (const disabledName of toDisable) {
      const parent = modMap.get(disabledName)
      if (!parent) continue

      if (parent.dependencies) {
        for (const depStr of parent.dependencies) {
          const parsed = parseDependencyString(depStr)
          if (parsed && parsed.type === "required" && !CORE_MODS.has(parsed.id)) {
            const child = modMap.get(parsed.id)
            if (child && child.enabled && !toDisable.has(child.name)) {
              candidates.add(child.name)
            }
          }
        }
      }
    }

    // For each candidate, check if ANY other mod that remains enabled still requires it
    for (const candidateName of candidates) {
      const candidateMod = modMap.get(candidateName)
      if (!candidateMod) continue

      let isRequiredElsewhere = false

      for (const other of allMods) {
        // Skip mods that are already disabled or scheduled to be disabled
        if (!other.enabled || toDisable.has(other.name)) {
          continue
        }

        // Check other's dependencies
        if (other.dependencies) {
          for (const depStr of other.dependencies) {
            const parsed = parseDependencyString(depStr)
            if (parsed && parsed.type === "required" && parsed.id === candidateName) {
              isRequiredElsewhere = true
              break
            }
          }
        }

        if (isRequiredElsewhere) break
      }

      if (!isRequiredElsewhere) {
        toDisable.add(candidateName)
        addedMore = true
      }
    }
  }

  return Array.from(toDisable).map((name) => [name, false])
}

function applyUpdatesToGraphGroups(
  groups: ModGroupGraph[],
  updateMap: Map<string, boolean>
): ModGroupGraph[] {
  return groups.map((g) => {
    let changed = false
    let nextRoot = g.root
    if (g.root && updateMap.has(g.root.name)) {
      const newEnabled = updateMap.get(g.root.name)!
      if (g.root.enabled !== newEnabled) {
        nextRoot = { ...g.root, enabled: newEnabled }
        changed = true
      }
    }

    const nextChildren = g.children.map((c) => {
      if (!c.missing && updateMap.has(c.name)) {
        const newEnabled = updateMap.get(c.name)!
        if (c.enabled !== newEnabled) {
          changed = true
          return { ...c, enabled: newEnabled }
        }
      }
      return c
    })

    if (!changed) return g

    const enabledCount =
      (nextRoot?.enabled ? 1 : 0) +
      nextChildren.filter((c) => !c.missing && c.enabled).length
    const total =
      (nextRoot ? 1 : 0) + nextChildren.filter((c) => !c.missing).length
    const state: "all" | "some" | "none" =
      enabledCount === total ? "all" : enabledCount === 0 ? "none" : "some"

    return {
      ...g,
      root: nextRoot,
      children: nextChildren,
      aggregate: {
        ...g.aggregate,
        enabled: enabledCount,
        total,
        state,
      },
    }
  })
}

interface ModManagerStore {
  mods: InstalledModGroup[]
  graphGroups: ModGroupGraph[]
  storageUsage: StorageUsage | null
  isLoading: boolean
  isCheckingUpdates: boolean
  isFactorioRunning: boolean
  searchQuery: string
  filterTab: ModFilterTab
  selectedMods: Set<string>
  autoCascadeDependencies: boolean
  
  loadMods: (silent?: boolean) => Promise<void>
  loadGraphGroups: () => Promise<void>
  loadStorageUsage: () => Promise<void>
  checkFactorioRunning: () => Promise<boolean>
  toggleMod: (name: string, enabled: boolean) => Promise<void>
  toggleModGroupEnabled: (group: ModGroupGraph, enable: boolean) => Promise<void>
  switchVersion: (modName: string, version: string) => Promise<void>
  deleteVersion: (modName: string, version: string) => Promise<void>
  checkUpdates: (targetFactorioVersion?: string) => Promise<void>
  setFilterTab: (tab: ModFilterTab) => void
  setSearchQuery: (query: string) => void
  setAutoCascadeDependencies: (enabled: boolean) => void
  toggleSelectMod: (name: string) => void
  selectAllFiltered: (filteredNames: string[]) => void
  clearSelection: () => void
  batchToggleSelected: (enable: boolean) => Promise<void>
  handleFactorioVersionChange: (targetVersion: string) => Promise<void>
  updateMod: (modName: string, targetVersion?: string) => Promise<void>
  updateAllMods: () => Promise<void>
}

export const useModManagerStore = create<ModManagerStore>((set, get) => ({
  mods: [],
  graphGroups: [],
  storageUsage: null,
  isLoading: false,
  isCheckingUpdates: false,
  isFactorioRunning: false,
  searchQuery: "",
  filterTab: "all",
  selectedMods: new Set<string>(),
  autoCascadeDependencies:
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY_CASCADE) !== "false"
      : true,

  loadMods: async (silent = false) => {
    if (!silent) set({ isLoading: true })
    try {
      const [groups, graph] = await Promise.all([
        invoke<InstalledModGroup[]>("get_installed_mod_groups"),
        invoke<ModGroupGraph[]>("get_installed_mod_groups_graph").catch((err) => {
          console.error("Failed to load graph groups:", err)
          return []
        }),
      ])

      // Preserve update flags (hasUpdate / latestVersion) from the existing store
      // so they survive a reload (e.g. switching back to the installed tab).
      const prev = get()
      const prevUpdateByName = new Map<string, { hasUpdate: boolean; latestVersion?: string }>()
      for (const m of prev.mods) {
        prevUpdateByName.set(m.name, { hasUpdate: m.hasUpdate, latestVersion: m.latestVersion })
      }
      for (const g of prev.graphGroups) {
        if (g.root) {
          prevUpdateByName.set(g.root.name, {
            hasUpdate: g.root.hasUpdate,
            latestVersion: g.root.latestVersion,
          })
        }
        for (const c of g.children) {
          prevUpdateByName.set(c.name, {
            hasUpdate: c.hasUpdate,
            latestVersion: c.latestVersion,
          })
        }
      }

      const applyUpdates = <T extends { name: string; hasUpdate: boolean; latestVersion?: string }>(
        item: T
      ): T => {
        const u = prevUpdateByName.get(item.name)
        if (!u) return item
        return { ...item, hasUpdate: u.hasUpdate, latestVersion: u.latestVersion } as T
      }

      const nextMods = groups.map((m) => applyUpdates(m))
      const nextGraphGroups = graph.map((g) => {
        const nextRoot = g.root ? applyUpdates(g.root) : null
        const nextChildren = g.children.map((c) => applyUpdates(c))
        // Recompute aggregate updateCount from preserved hasUpdate flags so the
        // "updates" filter tab keeps working after a reload.
        const rootUpdateCount = nextRoot?.hasUpdate ? 1 : 0
        const childUpdateCount = nextChildren.filter((c) => !c.missing && c.hasUpdate).length
        return {
          ...g,
          root: nextRoot,
          children: nextChildren,
          updateCount: rootUpdateCount + childUpdateCount,
        }
      })

      set({ mods: nextMods, graphGroups: nextGraphGroups, isLoading: false })
      get().loadStorageUsage()
    } catch (e) {
      console.error("Failed to load installed mods:", e)
      set({ isLoading: false })
    }
  },

  loadGraphGroups: async () => {
    try {
      const graph = await invoke<ModGroupGraph[]>("get_installed_mod_groups_graph")
      set({ graphGroups: graph })
    } catch (e) {
      console.error("Failed to load graph groups:", e)
    }
  },

  loadStorageUsage: async () => {
    try {
      const usage = await invoke<StorageUsage>("get_mod_storage_usage")
      set({ storageUsage: usage })
    } catch (e) {
      console.error("Failed to load storage usage:", e)
    }
  },

  checkFactorioRunning: async () => {
    try {
      const running = await invoke<boolean>("is_factorio_running")
      set({ isFactorioRunning: running })
      return running
    } catch {
      return false
    }
  },

  toggleMod: async (name: string, enabled: boolean) => {
    const { mods, graphGroups, autoCascadeDependencies } = get()
    const updates = autoCascadeDependencies
      ? calculateCascadeUpdates(name, enabled, mods)
      : ([[name, enabled]] as Array<[string, boolean]>)

    // Optimistic UI update for both flat and graph views
    const previousMods = mods
    const previousGraphGroups = graphGroups
    const updateMap = new Map(updates)
    set({
      mods: previousMods.map((m) =>
        updateMap.has(m.name) ? { ...m, enabled: updateMap.get(m.name)! } : m
      ),
      graphGroups: applyUpdatesToGraphGroups(previousGraphGroups, updateMap),
    })

    try {
      await invoke("set_mods_enabled_batch", { updates })
      // Re-read silently to refresh dependency health checks
      const [refreshed, graph] = await Promise.all([
        invoke<InstalledModGroup[]>("get_installed_mod_groups"),
        invoke<ModGroupGraph[]>("get_installed_mod_groups_graph").catch(() => []),
      ])
      set({ mods: refreshed, graphGroups: graph })
    } catch (e) {
      console.error("Failed to toggle mod:", e)
      // Rollback on error
      set({ mods: previousMods, graphGroups: previousGraphGroups })
      throw e
    }
  },

  toggleModGroupEnabled: async (group: ModGroupGraph, enable: boolean) => {
    const toUpdate: Array<[string, boolean]> = []
    if (group.root) {
      toUpdate.push([group.root.name, enable])
    }
    for (const child of group.children) {
      if (!child.missing) {
        toUpdate.push([child.name, enable])
      }
    }
    if (toUpdate.length === 0) return

    const { mods, graphGroups } = get()
    const previousMods = mods
    const previousGraphGroups = graphGroups
    const updateMap = new Map(toUpdate)

    // Optimistically update only this mod group and its mods
    set({
      mods: previousMods.map((m) =>
        updateMap.has(m.name) ? { ...m, enabled: updateMap.get(m.name)! } : m
      ),
      graphGroups: applyUpdatesToGraphGroups(previousGraphGroups, updateMap),
    })

    try {
      await invoke("set_mods_enabled_batch", { updates: toUpdate })
      // Silently refresh graph and mods without setting isLoading: true (no flash/reload)
      const [refreshed, graph] = await Promise.all([
        invoke<InstalledModGroup[]>("get_installed_mod_groups"),
        invoke<ModGroupGraph[]>("get_installed_mod_groups_graph").catch(() => []),
      ])
      set({ mods: refreshed, graphGroups: graph })
    } catch (e) {
      console.error("Failed to toggle mod group:", e)
      set({ mods: previousMods, graphGroups: previousGraphGroups })
      throw e
    }
  },

  switchVersion: async (modName: string, version: string) => {
    await invoke("set_active_mod_version", { modName, version })
    await get().loadMods()
    await get().checkUpdates()
  },

  deleteVersion: async (modName: string, version: string) => {
    await invoke("delete_mod_version", { modName, version })
    await get().loadMods()
  },

  checkUpdates: async (targetFactorioVersion?: string) => {
    set({ isCheckingUpdates: true })
    try {
      const updatedDetails = await invoke<
        Array<{
          name: string
          hasUpdate: boolean
          latestVersion?: string
          newerVersions?: string[]
        }>
      >("check_mod_updates", { targetFactorioVersion })

      const updateMap = new Map(updatedDetails.map((u) => [u.name, u]))
      set((state) => {
        const nextMods = state.mods.map((m) => {
          const update = updateMap.get(m.name)
          if (update) {
            return {
              ...m,
              hasUpdate: update.hasUpdate,
              latestVersion: update.latestVersion,
            }
          }
          return m
        })

        const nextGraphGroups = state.graphGroups.map((g) => {
          const rootU = g.root ? updateMap.get(g.root.name) : undefined
          const nextRoot = g.root
            ? {
                ...g.root,
                hasUpdate: rootU ? rootU.hasUpdate : g.root.hasUpdate,
                latestVersion: rootU ? rootU.latestVersion : g.root.latestVersion,
              }
            : null
          const nextChildren = g.children.map((c) => {
            const childU = updateMap.get(c.name)
            return {
              ...c,
              hasUpdate: childU ? childU.hasUpdate : c.hasUpdate,
              latestVersion: childU ? childU.latestVersion : c.latestVersion,
            }
          })
          const rootUpdateCount = nextRoot?.hasUpdate ? 1 : 0
          const childUpdateCount = nextChildren.filter((c) => !c.missing && c.hasUpdate).length
          return {
            ...g,
            root: nextRoot,
            children: nextChildren,
            updateCount: rootUpdateCount + childUpdateCount,
          }
        })

        return {
          mods: nextMods,
          graphGroups: nextGraphGroups,
          isCheckingUpdates: false,
        }
      })
    } catch (e) {
      console.error("Failed to check mod updates:", e)
      set({ isCheckingUpdates: false })
    }
  },

  setFilterTab: (tab: ModFilterTab) => set({ filterTab: tab }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setAutoCascadeDependencies: (enabled: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CASCADE, String(enabled))
    }
    set({ autoCascadeDependencies: enabled })
  },

  toggleSelectMod: (name: string) => {
    set((state) => {
      const next = new Set(state.selectedMods)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return { selectedMods: next }
    })
  },

  selectAllFiltered: (filteredNames: string[]) => {
    set({ selectedMods: new Set(filteredNames) })
  },

  clearSelection: () => set({ selectedMods: new Set() }),

  batchToggleSelected: async (enable: boolean) => {
    const { selectedMods, mods, autoCascadeDependencies } = get()
    const allUpdatesMap = new Map<string, boolean>()

    for (const name of selectedMods) {
      if (!CORE_MODS.has(name)) {
        if (autoCascadeDependencies) {
          const cascade = calculateCascadeUpdates(name, enable, mods)
          for (const [n, val] of cascade) {
            allUpdatesMap.set(n, val)
          }
        } else {
          allUpdatesMap.set(name, enable)
        }
      }
    }

    const updates = Array.from(allUpdatesMap.entries())
    if (updates.length > 0) {
      const { mods, graphGroups } = get()
      const previousMods = mods
      const previousGraphGroups = graphGroups
      set({
        mods: previousMods.map((m) =>
          allUpdatesMap.has(m.name)
            ? { ...m, enabled: allUpdatesMap.get(m.name)! }
            : m
        ),
        graphGroups: applyUpdatesToGraphGroups(previousGraphGroups, allUpdatesMap),
      })

      try {
        await invoke("set_mods_enabled_batch", { updates })
        const [refreshed, graph] = await Promise.all([
          invoke<InstalledModGroup[]>("get_installed_mod_groups"),
          invoke<ModGroupGraph[]>("get_installed_mod_groups_graph").catch(() => []),
        ])
        set({ mods: refreshed, graphGroups: graph, selectedMods: new Set() })
      } catch (e) {
        console.error("Failed to batch toggle mods:", e)
        set({ mods: previousMods, graphGroups: previousGraphGroups })
        throw e
      }
    }
  },

  handleFactorioVersionChange: async (targetVersion: string) => {
    // Refresh installed mods so the new Factorio version is reflected in compatibility checks
    await get().loadMods(true)
    // Re-check updates so upgrade/downgrade badges are recalculated for the new target version
    await get().checkUpdates(targetVersion)
  },

  updateMod: async (modName: string, targetVersion?: string) => {
    const mod = get().mods.find((m) => m.name === modName)
    const ver = targetVersion || mod?.latestVersion
    if (!ver) return

    // If the target version is already stashed (downloaded previously), just switch
    // to it instead of re-downloading from the portal.
    const isInStash = mod?.stashedVersions?.some((s) => s.version === ver)
    if (isInStash) {
      await get().switchVersion(modName, ver)
      return
    }

    let targetModsFolder = await invoke<string | null>("get_mods_folder")
    if (!targetModsFolder) {
      targetModsFolder = await invoke<string>("detect_default_mods_folder")
    }

    const factorioVer = useSettingsStore.getState().factorioVersion
    const cleanFactorioVer =
      !factorioVer || factorioVer === "all" || factorioVer === "any"
        ? null
        : factorioVer

    let reqDeps: any[] = []
    try {
      const details = await invoke<any>("fetch_mod_details", { modId: modName })
      const matchedRelease = (details.releases || []).find((r: any) => r.version === ver)
      if (matchedRelease?.dependencies?.required) {
        reqDeps = matchedRelease.dependencies.required
      }
    } catch (e) {
      console.warn("Could not fetch release dependencies for update:", e)
    }

    const directDeps = reqDeps
      .filter((d: any) => !CORE_MODS.has((d.id || d.name || "").toLowerCase()))
      .map((d: any) => ({
        id: d.id || d.name,
        ineq: d.ineq || ">=",
        version: d.version || "",
      }))

    const mainMods = [
      {
        id: modName,
        title: mod?.title || modName,
        version: ver,
        file_name: `${modName}_${ver}.zip`,
        sha1: "",
        reason: "direct",
      },
    ]

    const resolvedBatch = await invoke<any[]>("resolve_download_batch", {
      mainMods,
      directDeps,
      includeRecommended: false,
      factorioVersion: cleanFactorioVer,
    })

    const groupsToRegister = [
      {
        parent: modName,
        dependencies: resolvedBatch
          .filter((item) => item.id !== modName)
          .map((item) => item.id),
      },
    ]
    useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

    await invoke("start_download_batch", {
      items: resolvedBatch,
      outputDir: targetModsFolder,
    })

    useDownloadsStore.getState().fetchTasks()
    await get().loadMods()
    // Refresh update flags after mods were updated so badges clear correctly
    await get().checkUpdates()
  },

  updateAllMods: async () => {
    const modsToUpdate = get().mods.filter((m) => m.hasUpdate && m.latestVersion)
    if (modsToUpdate.length === 0) return

    let targetModsFolder = await invoke<string | null>("get_mods_folder")
    if (!targetModsFolder) {
      targetModsFolder = await invoke<string>("detect_default_mods_folder")
    }

    const factorioVer = useSettingsStore.getState().factorioVersion
    const cleanFactorioVer =
      !factorioVer || factorioVer === "all" || factorioVer === "any"
        ? null
        : factorioVer

    const mainMods = modsToUpdate.map((m) => ({
      id: m.name,
      title: m.title || m.name,
      version: m.latestVersion!,
      file_name: `${m.name}_${m.latestVersion!}.zip`,
      sha1: "",
      reason: "direct",
    }))

    const allDirectDeps: any[] = []
    for (const m of modsToUpdate) {
      try {
        const details = await invoke<any>("fetch_mod_details", { modId: m.name })
        const matchedRelease = (details.releases || []).find((r: any) => r.version === m.latestVersion)
        const reqs = matchedRelease?.dependencies?.required || []
        for (const req of reqs) {
          if (!CORE_MODS.has((req.id || req.name || "").toLowerCase())) {
            allDirectDeps.push({
              id: req.id || req.name,
              ineq: req.ineq || ">=",
              version: req.version || "",
            })
          }
        }
      } catch (e) {
        console.warn(`Could not fetch details for update of ${m.name}:`, e)
      }
    }

    const resolvedBatch = await invoke<any[]>("resolve_download_batch", {
      mainMods,
      directDeps: allDirectDeps,
      includeRecommended: false,
      factorioVersion: cleanFactorioVer,
    })

    const groupsToRegister = modsToUpdate.map((m) => ({
      parent: m.name,
      dependencies: resolvedBatch
        .filter((item) => item.id !== m.name && item.reason === "dependency")
        .map((item) => item.id),
    }))
    useDownloadsStore.getState().registerDownloadGroups(groupsToRegister)

    await invoke("start_download_batch", {
      items: resolvedBatch,
      outputDir: targetModsFolder,
    })

    useDownloadsStore.getState().fetchTasks()
    await get().loadMods()
    // Refresh update flags after mods were updated so badges clear correctly
    await get().checkUpdates()
  },
}))
