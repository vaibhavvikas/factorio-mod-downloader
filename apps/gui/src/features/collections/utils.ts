import type { ProfileModEntry, MissingModDetail } from "./types"
import type { InstalledModGroup } from "@/features/mod-manager/types"

/**
 * Calculates which mods or specific mod versions requested by a collection profile
 * are missing or not found in the local Factorio mods folder or cache/stash.
 */
export function getMissingProfileMods(
  profileMods: ProfileModEntry[],
  installedMods: InstalledModGroup[]
): MissingModDetail[] {
  const installedMap = new Map<string, InstalledModGroup>(
    (installedMods || [])
      .filter(Boolean)
      .map((m) => [(m.name || "").toLowerCase(), m])
  )

  const missing: MissingModDetail[] = []

  for (const m of profileMods) {
    if (!m || !m.name || m.name.toLowerCase() === "base") continue
    const installed = installedMap.get(m.name.toLowerCase())

    const hasAnyLocalVersion = Boolean(installed?.activeVersion) || (installed?.stashedVersions && installed.stashedVersions.length > 0)
    if (!installed || !hasAnyLocalVersion) {
      missing.push({
        mod: m,
        reason: "not_installed",
      })
      continue
    }

    const targetVer = m.version && m.version !== "latest" ? m.version.trim() : null
    if (targetVer) {
      const isActiveVer = installed.activeVersion === targetVer
      const isStashedVer = (installed.stashedVersions || []).some((s) => s.version === targetVer)
      if (!isActiveVer && !isStashedVer) {
        missing.push({
          mod: m,
          reason: "version_not_found",
          installedVersion: installed.activeVersion || undefined,
        })
      }
    }
  }

  return missing
}

