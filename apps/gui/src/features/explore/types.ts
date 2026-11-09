export interface ModSearchResultItem {
  name: string
  title: string
  owner: string
  summary: string
  category: string
  downloads_count: number
  thumbnail?: string
  latest_version: string
  tags: string[]
  requires_space_age?: boolean
}

export interface ModSearchResponse {
  results: ModSearchResultItem[]
  page: number
  total_pages: number
}

export interface ExploreFilters {
  query?: string
  category?: string | null
  categories?: string[] | null
  expansion?: string | null
  factorioVersion?: string | null
  page?: number
}
