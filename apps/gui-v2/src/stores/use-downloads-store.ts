import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { BackendDownloadTask, FormattedDownloadTask, DownloadStatusType } from "@/features/downloads/types"
import { useModQueueStore } from "@/stores/use-mod-queue-store"

interface DownloadsState {
  tasks: FormattedDownloadTask[]
  activeCount: number
  totalSpeed: string
  overallProgress: number
  overallProgressPercent: number
  activeDownload: { modName: string; progress: number; statusText?: string } | null
  pausedTaskIds: string[]
  completedTimestamps: Record<string, number>
  lastCompletedTask: FormattedDownloadTask | null

  fetchTasks: () => Promise<void>
  togglePauseTask: (rawId: string) => Promise<void> | void
  cancelTask: (rawId: string) => Promise<void>
  cancelAllTasks: () => Promise<void>
  retryTask: (rawId: string) => Promise<void>
  clearCompletedTasks: () => Promise<void>
  removeTask: (rawId: string) => void
  startPolling: () => () => void
}

let pollTimeout: ReturnType<typeof setTimeout> | null = null
let subscriberCount = 0
let isPollingRunning = false

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  tasks: [],
  activeCount: 0,
  totalSpeed: "0.0",
  overallProgress: 0,
  overallProgressPercent: 0,
  activeDownload: null,
  pausedTaskIds: [],
  completedTimestamps: {},
  lastCompletedTask: null,

  fetchTasks: async () => {
    try {
      const backendTasks = await invoke<BackendDownloadTask[]>("get_download_tasks")
      if (!backendTasks) return

      const state = get()
      const prevTasks = state.tasks
      const prevMap = new Map(prevTasks.map((t) => [t.rawId, t]))
      const targetMods = useModQueueStore.getState().targetMods

      let pendingCount = 0
      const newCompletedTimestamps = { ...state.completedTimestamps }

      let totalActiveBytes = 0
      let totalActiveDownloaded = 0
      let totalSpeedNum = 0
      let newlyCompleted: FormattedDownloadTask | null = null

      const formatted: FormattedDownloadTask[] = backendTasks.map((bt) => {
        let statusStr = typeof bt.status === "string" ? bt.status : (bt.status?.status || "pending")
        const errorMsg = typeof bt.status === "object" ? bt.status.message : undefined

        const isPaused = statusStr === "paused" || state.pausedTaskIds.includes(bt.id)
        if (isPaused && (statusStr === "downloading" || statusStr === "pending")) {
          statusStr = "paused"
        }

        let progress = 0
        let progressPercent = 0
        const isDone = ["completed", "alreadyExists", "updated", "downgraded"].includes(statusStr)
        if (isDone) {
          progress = 100
          progressPercent = 100
          if (!newCompletedTimestamps[bt.id]) {
            newCompletedTimestamps[bt.id] = Date.now()
          }
        } else if (bt.totalBytes > 0) {
          const exactPercent = Math.min(100, Math.max(0, (bt.downloadedBytes / bt.totalBytes) * 100))
          progress = Math.round(exactPercent)
          progressPercent = parseFloat(exactPercent.toFixed(2))
        }

        const prev = prevMap.get(bt.id)
        if (isDone && prev && prev.statusType !== "completed" && prev.statusType !== "alreadyExists") {
          newlyCompleted = prev
        }

        const totalMb = bt.totalBytes > 0 ? bt.totalBytes / (1024 * 1024) : 0
        const downloadedMb = bt.downloadedBytes / (1024 * 1024)

        // Speed calculation
        let speed = "0.0"
        if (statusStr === "downloading") {
          if (prev && prev.downloadedBytes < bt.downloadedBytes) {
            const bytesDiff = bt.downloadedBytes - prev.downloadedBytes
            const mbPerSec = (bytesDiff / (1024 * 1024)) * 2
            speed = mbPerSec > 0 ? mbPerSec.toFixed(1) : "0.0"
          } else if (prev?.speed && prev.speed !== "0.0") {
            speed = prev.speed
          } else if (downloadedMb > 0) {
            speed = "4.2"
          }
          totalSpeedNum += parseFloat(speed) || 0
        }

        // ETA calculation
        let etaSeconds: number | undefined
        let etaFormatted: string | undefined
        if (statusStr === "downloading" && bt.totalBytes > bt.downloadedBytes && parseFloat(speed) > 0) {
          const remainingBytes = bt.totalBytes - bt.downloadedBytes
          const speedBytes = parseFloat(speed) * 1024 * 1024
          etaSeconds = Math.ceil(remainingBytes / speedBytes)
          if (etaSeconds <= 1) {
            etaFormatted = "1s"
          } else if (etaSeconds < 60) {
            etaFormatted = `${etaSeconds}s`
          } else if (etaSeconds < 3600) {
            const mins = Math.floor(etaSeconds / 60)
            const secs = etaSeconds % 60
            etaFormatted = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
          } else {
            const hours = Math.floor(etaSeconds / 3600)
            const mins = Math.floor((etaSeconds % 3600) / 60)
            etaFormatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
          }
        }

        // Origin reasoning & thumbnail lookup from targetMods
        const directTarget = targetMods.find((m) => m.name === bt.id)
        let thumbnail = directTarget?.thumbnail
        let reason = directTarget ? "Direct target mod" : undefined
        let installGroup = directTarget ? directTarget.title : undefined

        if (!reason) {
          const parentMod = targetMods.find((m) =>
            m.dependencies.some((d) => d.name === bt.id)
          )
          if (parentMod) {
            reason = `Dependency of ${parentMod.title}`
            installGroup = parentMod.title
            if (!thumbnail) thumbnail = parentMod.thumbnail
          } else {
            reason = "Dependency"
            installGroup = "Dependencies"
          }
        }

        let queuePos: number | undefined
        if (statusStr === "pending") {
          pendingCount++
          queuePos = pendingCount
        }

        if (statusStr === "downloading" || statusStr === "pending" || statusStr === "paused") {
          totalActiveBytes += bt.totalBytes || 15 * 1024 * 1024
          totalActiveDownloaded += bt.downloadedBytes
        }

        return {
          id: `${bt.id}_${bt.version}`,
          rawId: bt.id,
          title: bt.title || bt.id,
          version: bt.version,
          fileName: bt.fileName,
          sha1: bt.sha1,
          downloadedBytes: bt.downloadedBytes,
          totalBytes: bt.totalBytes,
          sizeMb: parseFloat(totalMb.toFixed(1)),
          downloadedMb: parseFloat(downloadedMb.toFixed(1)),
          progress,
          progressPercent,
          speed,
          etaSeconds,
          etaFormatted,
          statusType: statusStr as DownloadStatusType,
          errorMessage: errorMsg,
          isPaused,
          completedAt: newCompletedTimestamps[bt.id],
          reason,
          thumbnail,
          queuePosition: queuePos,
          installGroup,
        }
      })

      const activeTasks = formatted.filter(
        (t) =>
          t.statusType === "downloading" ||
          t.statusType === "pending" ||
          t.statusType === "paused"
      )

      let currentActiveDownload: { modName: string; progress: number; statusText?: string } | null = null
      const downloadingTask = activeTasks.find((t) => t.statusType === "downloading") || activeTasks[0]
      if (downloadingTask) {
        currentActiveDownload = {
          modName: downloadingTask.title,
          progress: downloadingTask.progress,
          statusText:
            downloadingTask.statusType === "pending"
              ? "Queued..."
              : downloadingTask.statusType === "paused"
              ? "Paused"
              : `${downloadingTask.progress}% (${downloadingTask.speed} MB/s)`,
        }
      }

      const overallExact =
        totalActiveBytes > 0
          ? Math.min(100, Math.max(0, (totalActiveDownloaded / totalActiveBytes) * 100))
          : 0
      const overallProgress = Math.round(overallExact)
      const overallProgressPercent = parseFloat(overallExact.toFixed(2))

      set({
        tasks: formatted,
        activeCount: activeTasks.length,
        totalSpeed: totalSpeedNum.toFixed(1),
        overallProgress,
        overallProgressPercent,
        activeDownload: currentActiveDownload,
        completedTimestamps: newCompletedTimestamps,
        lastCompletedTask: newlyCompleted || state.lastCompletedTask,
      })
    } catch {
      // Ignore background poll errors during teardown
    }
  },

  togglePauseTask: async (rawId: string) => {
    try {
      const isNowPaused = await invoke<boolean>("toggle_pause_download_task", { taskId: rawId })
      set((state) => ({
        pausedTaskIds: isNowPaused
          ? (state.pausedTaskIds.includes(rawId) ? state.pausedTaskIds : [...state.pausedTaskIds, rawId])
          : state.pausedTaskIds.filter((id) => id !== rawId),
      }))
      await get().fetchTasks()
    } catch (err) {
      console.error("Failed to toggle pause task:", err)
    }
  },

  cancelTask: async (rawId: string) => {
    try {
      await invoke("cancel_download_task", { taskId: rawId })
      set((state) => ({
        pausedTaskIds: state.pausedTaskIds.filter((id) => id !== rawId),
      }))
      await get().fetchTasks()
    } catch (err) {
      console.error("Failed to cancel task:", err)
    }
  },

  cancelAllTasks: async () => {
    try {
      await invoke("cancel_all_download_tasks")
      set({ pausedTaskIds: [] })
      await get().fetchTasks()
    } catch (err) {
      console.error("Failed to cancel all tasks:", err)
    }
  },

  retryTask: async (rawId: string) => {
    try {
      let modsFolder = await invoke<string | null>("get_mods_folder")
      if (!modsFolder) {
        modsFolder = await invoke<string>("detect_default_mods_folder")
      }
      await invoke("retry_download_task", { taskId: rawId, outputDir: modsFolder || "" })
      set((state) => ({
        pausedTaskIds: state.pausedTaskIds.filter((id) => id !== rawId),
      }))
      await get().fetchTasks()
    } catch (err) {
      console.error("Failed to retry task:", err)
    }
  },

  clearCompletedTasks: async () => {
    try {
      await invoke("clear_completed_download_tasks")
      await get().fetchTasks()
    } catch (err) {
      console.error("Failed to clear completed tasks:", err)
    }
  },

  removeTask: (rawId: string) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.rawId !== rawId),
      pausedTaskIds: state.pausedTaskIds.filter((id) => id !== rawId),
    }))
  },

  startPolling: () => {
    subscriberCount++
    if (!isPollingRunning) {
      isPollingRunning = true

      const pollLoop = async () => {
        if (!isPollingRunning || subscriberCount <= 0) return
        try {
          await get().fetchTasks()
        } catch {
          // ignore error during poll
        }
        if (!isPollingRunning || subscriberCount <= 0) return
        const hasActive = get().activeCount > 0
        // Poll every 150ms when active downloads are running for smooth real-time updates,
        // and 800ms when idle to conserve system resources.
        pollTimeout = setTimeout(pollLoop, hasActive ? 150 : 800)
      }

      pollLoop()
    }

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0) {
        isPollingRunning = false
        if (pollTimeout) {
          clearTimeout(pollTimeout)
          pollTimeout = null
        }
      }
    }
  },
}))
