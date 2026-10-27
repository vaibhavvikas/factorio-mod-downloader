export type DownloadStatusType =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "alreadyExists"
  | "updated"
  | "downgraded"
  | "failed"

export interface BackendDownloadTask {
  id: string
  title: string
  version: string
  fileName: string
  sha1: string
  downloadedBytes: number
  totalBytes: number
  status:
    | { status: string; message?: string }
    | string
}

export interface FormattedDownloadTask {
  id: string
  rawId: string
  title: string
  version: string
  fileName: string
  sha1?: string
  downloadedBytes: number
  totalBytes: number
  sizeMb: number
  downloadedMb: number
  progress: number // 0 to 100 integer for text
  progressPercent: number // 0 to 100 float for smooth subpixel bar animation
  speed: string
  etaSeconds?: number
  etaFormatted?: string
  statusType: DownloadStatusType
  errorMessage?: string
  isPaused?: boolean
  completedAt?: number
  reason?: string
  thumbnail?: string
  queuePosition?: number
  installGroup?: string
}
