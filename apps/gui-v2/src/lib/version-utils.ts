export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    (v || "")
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export function isVersionNewer(onlineVersion: string, currentVersion: string): boolean {
  return compareVersions(onlineVersion, currentVersion) > 0
}

/**
 * Checks if a mod release's Factorio version matches or is compatible with the target Factorio version.
 */
export function isFactorioVersionCompatible(
  releaseFactorioVersion?: string | null,
  targetFactorioVersion?: string | null
): boolean {
  if (!targetFactorioVersion) return true
  const target = targetFactorioVersion.trim().toLowerCase().replace(/^v/, "")
  if (!target || target === "all" || target === "any") return true
  if (!releaseFactorioVersion) return true
  const rel = releaseFactorioVersion.trim().toLowerCase().replace(/^v/, "")
  return (
    rel === target ||
    rel.startsWith(target) ||
    target.startsWith(rel)
  )
}
