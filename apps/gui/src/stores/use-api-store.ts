import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"

const HEALTH_POLL_INTERVAL_MS = 30_000

interface ApiConnectionStore {
  apiConnected: boolean
  checking: boolean
  checkApiHealth: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export const useApiStore = create<ApiConnectionStore>((set, get) => ({
  apiConnected: true,
  checking: false,

  checkApiHealth: async () => {
    set({ checking: true })
    try {
      const online = await invoke<boolean>("check_api_health")
      set({ apiConnected: online, checking: false })
    } catch {
      set({ apiConnected: false, checking: false })
    }
  },

  startPolling: () => {
    if (pollTimer) return
    get().checkApiHealth()
    pollTimer = setInterval(() => get().checkApiHealth(), HEALTH_POLL_INTERVAL_MS)
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  },
}))
