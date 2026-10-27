export { cn } from "cn"

export async function openExternalUrl(url: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      const { openUrl } = await import("@tauri-apps/plugin-opener")
      await openUrl(url)
    } else {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  } catch (err) {
    console.error("Failed to open external URL:", err)
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

/**
 * Open a mod's official Factorio Mod Portal page in the user's default browser.
 */
export async function openModPortal(modName: string): Promise<void> {
  const url = `https://mods.factorio.com/mod/${encodeURIComponent(modName)}`
  await openExternalUrl(url)
}

/**
 * Returns OS-aware shortcut label (e.g. ⌘J on macOS, Ctrl+J on Windows/Linux).
 */
export function getShortcutLabel(key: string): string {
  if (typeof navigator !== "undefined") {
    const platform =
      (navigator as any).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent ||
      ""
    if (/Mac|iPhone|iPad|iPod/i.test(platform)) {
      return `⌘${key}`
    }
  }
  return `Ctrl+${key}`
}
