import { useQuery } from "@tanstack/react-query"
import { invoke } from "@tauri-apps/api/core"
import type { ModSearchResponse, ExploreFilters } from "../types"

export async function fetchMods(filters: ExploreFilters): Promise<ModSearchResponse> {
  if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
    throw new Error(
      "Tauri backend IPC is only available inside the native desktop application. Please view in the running Factorio Mod Downloader window."
    )
  }

  const trimmed = filters.query?.trim() || null
  const categories =
    filters.categories && filters.categories.length > 0
      ? filters.categories
      : null

  return await invoke<ModSearchResponse>("browse_mods", {
    query: trimmed,
    category: filters.category || null,
    categories,
    expansion: filters.expansion || null,
    factorioVersion: filters.factorioVersion || null,
    page: filters.page || 1,
  })
}

export function useModsQuery(filters: ExploreFilters) {
  return useQuery({
    queryKey: [
      "mods",
      {
        query: filters.query?.trim() || "",
        categories: filters.categories || [],
        expansion: filters.expansion || null,
        factorioVersion: filters.factorioVersion || null,
        page: filters.page || 1,
      },
    ],
    queryFn: () => fetchMods(filters),
    placeholderData: (previousData) => previousData, // Keep previous page data while fetching next page for instant fast transitions
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  })
}
