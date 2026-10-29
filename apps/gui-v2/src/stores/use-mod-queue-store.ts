import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { TargetModItem, TreeNode, DependencyType } from "@/features/queue/types"
import { isFactorioVersionCompatible } from "@/lib/version-utils"

function parseReleaseTreeNodes(release: any): TreeNode[] {
  const deps = release?.dependencies || {
    required: [],
    recommended: [],
    optional: [],
    incompatible: [],
  }
  const treeNodes: TreeNode[] = []
  const mapDep = (dep: any, type: DependencyType): TreeNode => ({
    id: `dep-${dep.id}-${Math.random().toString(36).substring(2, 7)}`,
    name: String(dep.id),
    ineq: dep.ineq,
    version: String(dep.version || ""),
    type,
  })

  ;(deps.required || []).forEach((d: any) => treeNodes.push(mapDep(d, "required")))
  ;(deps.recommended || []).forEach((d: any) => treeNodes.push(mapDep(d, "recommended")))
  ;(deps.optional || []).forEach((d: any) => treeNodes.push(mapDep(d, "optional")))
  ;(deps.incompatible || []).forEach((d: any) => treeNodes.push(mapDep(d, "incompatible")))

  return treeNodes
}

export type QueueStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "error"
  | "cancelled"

export interface QueuedModItem {
  name: string
  title: string
  owner: string
  version?: string
  thumbnail?: string
  status: QueueStatus
  progress?: number // 0 to 100
  downloadedBytes?: number
  totalBytes?: number
  speed?: string
  error?: string
  addedAt: number
}

interface ModQueueState {
  // Staged Target Mods in the Queue Manager
  targetMods: TargetModItem[]
  expandedCardIds: string[]
  autoIncludeRecommended: boolean
  autoIncludeOptional: boolean
  
  // Actions for Target Mods
  addTargetMod: (mod: TargetModItem) => void
  removeTargetMod: (id: string) => void
  setExpandedCardIds: (ids: string[]) => void
  updateTargetModVersion: (
    id: string,
    version: string,
    dependencies: TreeNode[],
    selectedDepIds: string[]
  ) => void
  updateAllModVersionsForFactorio: (factorioVersion: string) => void
  toggleTargetModDep: (modId: string, depId: string) => void
  toggleTargetModSection: (
    modId: string,
    type: "recommended" | "optional",
    selectAll: boolean
  ) => void
  clearTargetMods: () => void
  setAutoIncludeRecommended: (enabled: boolean) => void
  setAutoIncludeOptional: (enabled: boolean) => void

  // Active Download Tasks Queue
  queue: QueuedModItem[]
  addToQueue: (item: Omit<QueuedModItem, "status" | "addedAt">) => void
  removeFromQueue: (name: string) => void
  updateModStatus: (
    name: string,
    status: QueueStatus,
    extra?: Partial<QueuedModItem>
  ) => void
  clearCompleted: () => void
  clearQueue: () => void
}

export const useModQueueStore = create<ModQueueState>()(
  persist(
    (set) => ({
      targetMods: [],
      expandedCardIds: [],
      autoIncludeRecommended: true,
      autoIncludeOptional: false,

      setExpandedCardIds: (ids) => set({ expandedCardIds: ids }),

      addTargetMod: (mod) =>
        set((state) => {
          if (state.targetMods.some((m) => m.name === mod.name)) {
            return state
          }
          return { targetMods: [...state.targetMods, mod] }
        }),

      removeTargetMod: (id) =>
        set((state) => ({
          targetMods: state.targetMods.filter((m) => m.id !== id && m.name !== id),
          expandedCardIds: state.expandedCardIds.filter((cardId) => cardId !== id),
        })),

      updateTargetModVersion: (id, version, dependencies, selectedDepIds) =>
        set((state) => ({
          targetMods: state.targetMods.map((m) =>
            m.id === id
              ? {
                  ...m,
                  selectedVersion: version,
                  dependencies,
                  selectedDepIds,
                }
              : m
          ),
        })),

      updateAllModVersionsForFactorio: (factorioVersion: string) =>
        set((state) => {
          if (!state.targetMods || state.targetMods.length === 0) return state

          let hasChanges = false
          const updatedTargetMods = state.targetMods.map((mod) => {
            if (!mod.availableReleases || mod.availableReleases.length === 0) return mod

            const compatible = mod.availableReleases.filter((r) =>
              isFactorioVersionCompatible(r.factorio_version, factorioVersion)
            )

            // Pick the latest release compatible with this Factorio version
            const bestRelease = compatible.length > 0 ? compatible[0] : null
            if (!bestRelease || bestRelease.version === mod.selectedVersion) {
              return mod
            }

            hasChanges = true
            const treeNodes = parseReleaseTreeNodes(bestRelease)
            const autoRec = state.autoIncludeRecommended
            const autoOpt = state.autoIncludeOptional
            const newSelectedIds = treeNodes
              .filter((d) => {
                if (d.type === "required") return true
                if (d.type === "recommended") return autoRec
                if (d.type === "optional") return autoOpt
                return false
              })
              .map((d) => d.id)

            return {
              ...mod,
              selectedVersion: bestRelease.version,
              dependencies: treeNodes.length > 0 ? treeNodes : mod.dependencies,
              selectedDepIds: newSelectedIds,
            }
          })

          return hasChanges ? { targetMods: updatedTargetMods } : state
        }),

      toggleTargetModDep: (modId, depId) =>
        set((state) => ({
          targetMods: state.targetMods.map((m) => {
            if (m.id !== modId) return m
            const isSelected = m.selectedDepIds.includes(depId)
            return {
              ...m,
              selectedDepIds: isSelected
                ? m.selectedDepIds.filter((id) => id !== depId)
                : [...m.selectedDepIds, depId],
            }
          }),
        })),

      toggleTargetModSection: (modId, type, selectAll) =>
        set((state) => ({
          targetMods: state.targetMods.map((m) => {
            if (m.id !== modId) return m
            const targetDeps = m.dependencies.filter((d) => d.type === type)
            const targetIds = targetDeps.map((d) => d.id)
            let newSelected = m.selectedDepIds.filter((id) => !targetIds.includes(id))
            if (selectAll) {
              newSelected = [...newSelected, ...targetIds]
            }
            return {
              ...m,
              selectedDepIds: newSelected,
            }
          }),
        })),

      clearTargetMods: () => set({ targetMods: [], expandedCardIds: [] }),

      setAutoIncludeRecommended: (enabled) =>
        set({ autoIncludeRecommended: enabled }),

      setAutoIncludeOptional: (enabled) =>
        set({ autoIncludeOptional: enabled }),

      queue: [],

      addToQueue: (item) =>
        set((state) => {
          const exists = state.queue.some((m) => m.name === item.name)
          if (exists) {
            return {
              queue: state.queue.map((m) =>
                m.name === item.name
                  ? { ...m, ...item, status: "queued", error: undefined }
                  : m
              ),
            }
          }
          return {
            queue: [
              ...state.queue,
              {
                ...item,
                status: "queued",
                addedAt: Date.now(),
              },
            ],
          }
        }),

      removeFromQueue: (name) =>
        set((state) => ({
          queue: state.queue.filter((m) => m.name !== name),
        })),

      updateModStatus: (name, status, extra) =>
        set((state) => ({
          queue: state.queue.map((m) =>
            m.name === name ? { ...m, status, ...extra } : m
          ),
        })),

      clearCompleted: () =>
        set((state) => ({
          queue: state.queue.filter(
            (m) => m.status !== "completed" && m.status !== "cancelled"
          ),
        })),

      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: "factorio-mod-queue",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
