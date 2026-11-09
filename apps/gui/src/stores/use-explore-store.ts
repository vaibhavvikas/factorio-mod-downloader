import { create } from "zustand"

interface ExploreState {
  query: string
  submittedQuery: string
  selectedCategories: string[]
  spaceAgeFilter: boolean
  viewMode: "grid" | "list"
  page: number

  setQuery: (query: string) => void
  setSubmittedQuery: (submittedQuery: string) => void
  setSelectedCategories: (
    categories: string[] | ((prev: string[]) => string[])
  ) => void
  setSpaceAgeFilter: (filter: boolean | ((prev: boolean) => boolean)) => void
  setViewMode: (mode: "grid" | "list") => void
  setPage: (page: number | ((prev: number) => number)) => void
  resetFilters: () => void
}

export const useExploreStore = create<ExploreState>((set) => ({
  query: "",
  submittedQuery: "",
  selectedCategories: [],
  spaceAgeFilter: false,
  viewMode: "grid",
  page: 1,

  setQuery: (query) => set({ query }),
  setSubmittedQuery: (submittedQuery) => set({ submittedQuery, page: 1 }),
  setSelectedCategories: (updater) =>
    set((state) => ({
      selectedCategories:
        typeof updater === "function"
          ? updater(state.selectedCategories)
          : updater,
      page: 1,
    })),
  setSpaceAgeFilter: (updater) =>
    set((state) => ({
      spaceAgeFilter:
        typeof updater === "function"
          ? updater(state.spaceAgeFilter)
          : updater,
      page: 1,
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setPage: (updater) =>
    set((state) => ({
      page: typeof updater === "function" ? updater(state.page) : updater,
    })),
  resetFilters: () =>
    set({
      query: "",
      submittedQuery: "",
      selectedCategories: [],
      spaceAgeFilter: false,
      page: 1,
    }),
}))
