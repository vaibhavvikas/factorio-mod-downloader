export type DependencyType = "required" | "recommended" | "optional" | "incompatible"

export interface TreeNode {
  id: string
  name: string
  ineq?: string
  version: string
  size?: number
  type: DependencyType
}

export interface ModVersionRelease {
  version: string
  factorio_version?: string
  released_at?: string
  dependencies: {
    required: { id: string; ineq: string; version: string }[]
    recommended: { id: string; ineq: string; version: string }[]
    optional: { id: string; ineq: string; version: string }[]
    incompatible: { id: string; ineq: string; version: string }[]
  }
}

export interface TargetModItem {
  id: string
  name: string
  title: string
  author: string
  category: string
  summary: string
  thumbnail?: string
  updatedAt?: string
  downloadsCount: number
  selectedVersion: string
  availableReleases: ModVersionRelease[]
  selectedDepIds: string[]
  dependencies: TreeNode[]
}

export interface BackendDependency {
  id: string
  ineq: string
  version: string
}

export interface BackendResolvedDownloadItem {
  id: string
  title: string
  version: string
  file_name: string
  sha1: string
}

export interface BackendModDetails {
  name: string
  title: string
  owner: string
  category: string
  summary: string
  thumbnail?: string
  updated_at?: string
  downloads_count: number
  releases: {
    version: string
    factorio_version: string
    released_at: string
    dependencies: {
      required: BackendDependency[]
      recommended: BackendDependency[]
      optional: BackendDependency[]
      incompatible: BackendDependency[]
    }
  }[]
  default_dependencies: {
    required: BackendDependency[]
    recommended: BackendDependency[]
    optional: BackendDependency[]
    incompatible: BackendDependency[]
  }
}
