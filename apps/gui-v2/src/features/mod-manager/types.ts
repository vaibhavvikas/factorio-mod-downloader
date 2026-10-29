export interface StashedModVersion {
  version: string
  fileName: string
  filePath: string
  sizeBytes: number
}

export interface HealthIssue {
  kind: "missing_dep" | "disabled_dep" | "incompatible_conflict" | "duplicate_root_zip" | "missing_active_version" | string
  message: string
}

export interface InstalledModGroup {
  name: string
  title: string
  author?: string
  category?: string
  thumbnail?: string
  enabled: boolean
  isVirtual: boolean
  isDirectory: boolean
  activeVersion: string
  activeFilePath?: string
  factorioVersion?: string
  stashedVersions: StashedModVersion[]
  dependencies: string[]
  hasUpdate: boolean
  latestVersion?: string
  healthIssues: HealthIssue[]
  pinned: boolean
  pinnedPolicy?: string
}

export interface StorageUsage {
  rootBytes: number
  stashBytes: number
  totalBytes: number
}

export interface UninstallPreview {
  targets: string[]
  cascadeRemovals: string[]
  keptDependencies: string[]
}

export interface ModGroupItem {
  id: string
  parent: InstalledModGroup
  dependencies: InstalledModGroup[]
}

export type GroupKind = "group" | "standalone" | "shared"
export type AggregateState = "all" | "some" | "none"

export interface GroupAggregate {
  enabled: number
  total: number
  state: AggregateState
}

export type ReferenceKind = "requires" | "uses" | "required_by" | "used_by"

export interface ModReference {
  kind: ReferenceKind | string
  targetName: string
  constraint?: string
  targetTitle?: string
  sourceMod?: string
  installedVersion?: string
}

export interface ChildNode {
  name: string
  title: string
  author?: string
  category?: string
  thumbnail?: string
  enabled: boolean
  isVirtual: boolean
  isDirectory: boolean
  activeVersion: string
  activeFilePath?: string
  factorioVersion?: string
  stashedVersions: StashedModVersion[]
  dependencies: string[]
  hasUpdate: boolean
  latestVersion?: string
  healthIssues: HealthIssue[]
  pinned: boolean
  pinnedPolicy?: string
  depth: number
  via?: string
  tag?: string
  missing: boolean
  constraint?: string
  references?: ModReference[]
}

export interface ModGroupGraph {
  id: string
  kind: GroupKind
  root?: InstalledModGroup | null
  children: ChildNode[]
  references: ModReference[]
  aggregate: GroupAggregate
  health: HealthIssue[]
  updateCount: number
  tag?: string | null
}

