import type { InstalledModGroup, ModGroupItem } from "./types"

const IGNORED_DEP_IDS = new Set([
  "base",
  "space-age",
  "quality",
  "elevated-rails",
  "recycler",
])

/**
 * Parses a Factorio dependency string (e.g. "base >= 2.0", "? alien-biomes", "(?) flib >= 0.1", "! conflict")
 * Returns parsed mod ID and dependency type, or null if ignored or invalid.
 */
export function parseDependencyString(dep: string): {
  id: string
  type: "required" | "optional" | "recommended" | "incompatible"
} | null {
  if (!dep || typeof dep !== "string") return null

  const match = dep.match(
    /^(\?|\(\?\)|!|~|\+|\(\+\))?\s*([%\w\s-]+?)(?:\s*(?:=>|==|=|<=|>=|<|>)\s*(?:\d+\.\d+\.\d+|\d+\.\d+))?$/
  )
  if (!match) return null

  const prefix = match[1] || ""
  const id = match[2].trim()

  if (IGNORED_DEP_IDS.has(id.toLowerCase())) {
    return null
  }

  let type: "required" | "optional" | "recommended" | "incompatible" = "required"
  if (prefix === "!") {
    type = "incompatible"
  } else if (prefix === "?" || prefix === "(?)") {
    type = "optional"
  } else if (prefix === "+" || prefix === "(+)") {
    type = "recommended"
  }

  return { id, type }
}

/**
 * Determines whether a mod is a root (top-level group) mod.
 *
 * Base conditions:
 * 1. A mod which has no parent will always be a root mod.
 * 2. A mod which is not a required dependency of another mod will always be a root mod.
 *    Only "required" edges are checked — recommended/optional/incompatible are never checked.
 *    If a mod is a required dependency of one mod and recommended/optional of another,
 *    it is still a root mod.
 * 3. If a mod is required by two or more mods, it will be a root node.
 */
function isRootMod(
  mod: InstalledModGroup,
  requiredBy: Map<string, Set<string>>,
  recommendedOrOptionalBy: Map<string, Set<string>>
): boolean {
  const reqs = requiredBy.get(mod.name)
  const requiredByCount = reqs?.size ?? 0

  // Conditions 1 & 2: no parent / not a required dependency of another mod
  if (requiredByCount === 0) return true

  // Condition 2 exception: required by exactly one mod, but also recommended/optional
  // by another mod -> still a root mod
  if (requiredByCount === 1 && reqs) {
    const [requiredByOne] = reqs
    const recommendedOrOptional = recommendedOrOptionalBy.get(mod.name)
    if (
      recommendedOrOptional &&
      Array.from(recommendedOrOptional).some((source) => source !== requiredByOne)
    ) {
      return true
    }
  }

  // Condition 3: required by two or more mods
  if (requiredByCount >= 2) return true

  return false
}

/**
 * Groups installed mods into root mods and their direct installed dependencies.
 *
 * How a group is determined (root selection):
 * - A mod is a root when it meets any base condition (see isRootMod).
 * - Non-root mods (required by exactly one mod, nothing else) are nested as a direct
 *   dependency of that single required-parent.
 *
 * The current linking design is preserved: each group keeps its root mod with its
 * direct dependencies nested under it, and links to other groups (references/chips)
 * are still added elsewhere untouched.
 */
export function groupInstalledMods(mods: InstalledModGroup[]): ModGroupItem[] {
  const modMap = new Map<string, InstalledModGroup>()
  mods.forEach((m) => modMap.set(m.name, m))

  // Build "required by" relationship from manifest dependencies.
  // Only "required" edges establish a parent -> child link; recommended/optional/
  // incompatible edges are never checked per the grouping rules.
  const requiredBy = new Map<string, Set<string>>()
  const recommendedOrOptionalBy = new Map<string, Set<string>>()

  for (const mod of mods) {
    if (!mod.dependencies || mod.dependencies.length === 0) continue

    for (const depStr of mod.dependencies) {
      const parsed = parseDependencyString(depStr)
      if (!parsed || parsed.type === "incompatible") continue

      // Only consider mods that are actually installed
      if (!modMap.has(parsed.id)) continue

      if (parsed.type === "required") {
        let sources = requiredBy.get(parsed.id)
        if (!sources) {
          sources = new Set()
          requiredBy.set(parsed.id, sources)
        }
        sources.add(mod.name)
      } else if (parsed.type === "recommended" || parsed.type === "optional") {
        let sources = recommendedOrOptionalBy.get(parsed.id)
        if (!sources) {
          sources = new Set()
          recommendedOrOptionalBy.set(parsed.id, sources)
        }
        sources.add(mod.name)
      }
    }
  }

  const groups: ModGroupItem[] = []

  for (const mod of mods) {
    if (!isRootMod(mod, requiredBy, recommendedOrOptionalBy)) {
      continue
    }

    // Collect direct installed dependencies that are not roots themselves.
    // Shared dependencies (required by 2+ mods) are roots and keep their own group,
    // so they are not nested here (links to those groups are preserved separately).
    const children: InstalledModGroup[] = []
    const seenChildNames = new Set<string>()

    if (mod.dependencies && mod.dependencies.length > 0) {
      for (const depStr of mod.dependencies) {
        const parsed = parseDependencyString(depStr)
        if (!parsed || parsed.type !== "required") continue

        const childMod = modMap.get(parsed.id)
        if (!childMod || childMod.name === mod.name) continue
        if (isRootMod(childMod, requiredBy, recommendedOrOptionalBy)) continue
        if (seenChildNames.has(childMod.name)) continue

        seenChildNames.add(childMod.name)
        children.push(childMod)
      }
    }

    // Sort dependencies alphabetically by title
    children.sort((a, b) => a.title.localeCompare(b.title))

    groups.push({
      id: mod.name,
      parent: mod,
      dependencies: children,
    })
  }

  return groups
}
