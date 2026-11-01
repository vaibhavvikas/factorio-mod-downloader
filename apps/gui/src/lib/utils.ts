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

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
}

/**
 * Decode HTML entities (e.g. &#34; -> ") from portal API strings before rendering.
 * Pure string parsing avoids DOM allocations and XSS injection vectors.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|#(\d+)|#x([0-9a-fA-F]+));/g, (match, dec, hex) => {
    if (ENTITY_MAP[match]) return ENTITY_MAP[match]
    if (dec) {
      const code = parseInt(dec, 10)
      return !isNaN(code) ? String.fromCharCode(code) : match
    }
    if (hex) {
      const code = parseInt(hex, 16)
      return !isNaN(code) ? String.fromCharCode(code) : match
    }
    return match
  })
}
