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

export type DownloadBatchKind = "single" | "queue" | "update" | "collection_apply" | "import"
export type DownloadBatchPhase = "downloading" | "verifying" | "installing" | "done" | "failed" | "cancelled" | "paused"
export type DownloadItemState = "queued" | "connecting" | "downloading" | "paused" | "verifying" | "downloaded" | "installed" | "failed" | "cancelled"

export interface DownloadItemNode {
  id: string
  batchId: string
  name: string
  version: string
  title: string
  reason: "direct" | "dependency" | string
  requestedBy: string[]
  position: number
  state: DownloadItemState
  bytesTotal: number
  bytesDone: number
  speed: string
  error?: string | null
  startedAt?: number | null
  finishedAt?: number | null
  sha1: string
  depth: number
  via?: string | null
  isRoot: boolean
  subtitle?: string | null
  thumbnail?: string | null
}

export interface DownloadBatch {
  id: string
  kind: DownloadBatchKind
  label: string
  createdAt: number
  phase: DownloadBatchPhase
  error?: string | null
  items: DownloadItemNode[]
}
