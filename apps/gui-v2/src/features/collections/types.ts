export interface ProfileModEntry {
  name: string
  version: string
  enabled: boolean
}

export interface MissingModDetail {
  mod: ProfileModEntry
  reason: "not_installed" | "version_not_found"
  installedVersion?: string
}

export interface CollectionProfile {
  id: string
  name: string
  description?: string
  factorioVersion?: string
  factorio_version?: string
  createdAt?: string
  updatedAt?: string
  created_at?: string
  updated_at?: string
  mods: ProfileModEntry[]
  hasSettingsSnapshot?: boolean
  has_settings_snapshot?: boolean
}
