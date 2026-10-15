import * as React from "react"
import {
  Search,
  Loader2,
  Package,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Filter,
  X,
  Rocket,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Field } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "cn"
import { ModCard } from "./mod-card"
import { ModListItem } from "./mod-list-item"
import type { ModSearchResponse, ModSearchResultItem } from "../types"

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "overhaul", label: "Overhaul" },
  { id: "tweaks", label: "Tweaks" },
  { id: "utilities", label: "Utilities" },
  { id: "mod-packs", label: "Mod Packs" },
  { id: "no-category", label: "No Category" },
  { id: "localizations", label: "Localizations" },
  { id: "scenarios", label: "Scenarios" },
]

function getPaginationItems(
  current: number,
  total: number
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [1];
  if (current > 3) {
    pages.push("ellipsis-start");
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push("ellipsis-end");
  }
  pages.push(total);
  return pages;
}

export interface ExploreViewProps {
  // Filter parameters preserved for future implementation
  selectedCategory?: string | null
  onCategoryChange?: (category: string | null) => void
  selectedExpansion?: string | null
  onExpansionChange?: (expansion: string | null) => void
  selectedVersion?: string | null
  onVersionChange?: (version: string | null) => void
  onDownloadMod?: (modName: string) => void
}

export function ExploreView({
  selectedCategory = null,
  selectedExpansion = null,
  selectedVersion = null,
  onExpansionChange,
  onDownloadMod,
}: ExploreViewProps) {
  const [query, setQuery] = React.useState("")
  const [submittedQuery, setSubmittedQuery] = React.useState("")
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    selectedCategory ? [selectedCategory] : []
  )
  const [spaceAgeFilter, setSpaceAgeFilter] = React.useState<boolean>(
    selectedExpansion === "space-age"
  )
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [results, setResults] = React.useState<ModSearchResultItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch mods from Tauri API (with mock fallback for web browser preview)
  const fetchMods = React.useCallback(
    async (
      searchQuery: string,
      pageNum: number,
      activeCategories: string[] = selectedCategories,
      isSpaceAge: boolean = spaceAgeFilter
    ) => {
      setLoading(true);
      setError(null);
      try {
        if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
          setError(
            "Tauri backend IPC is only available inside the native desktop application. Please view in the running Factorio Mod Downloader window."
          );
          setResults([]);
          setTotalPages(1);
          return;
        }

        const trimmed = searchQuery.trim();
        const res = await invoke<ModSearchResponse>("browse_mods", {
          query: trimmed || null,
          category: null,
          categories: activeCategories.length > 0 ? activeCategories : null,
          expansion: isSpaceAge ? "space-age" : null,
          factorioVersion: selectedVersion,
          page: pageNum,
        });

        setResults(res.results || []);
        setTotalPages(Math.max(1, res.total_pages || 1));
      } catch (err: any) {
        console.error("Failed to browse mods:", err);
        setError(err?.toString() || "Failed to load mods");
        setResults([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [selectedVersion]
  );

  // Fetch mods whenever query, page, or filters change
  React.useEffect(() => {
    fetchMods(submittedQuery, page, selectedCategories, spaceAgeFilter);
  }, [fetchMods, submittedQuery, page, selectedCategories, spaceAgeFilter]);

  // Search only on Enter or clicking the search button
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmittedQuery(query);
  };

  // Toggle Space Age filter
  const toggleSpaceAge = () => {
    setPage(1);
    setSpaceAgeFilter((prev) => {
      const next = !prev;
      onExpansionChange?.(next ? "space-age" : null);
      return next;
    });
  };

  // Toggle category in multi-select
  const toggleCategory = (catId: string) => {
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  // Clear all categories
  const clearCategories = () => {
    setPage(1);
    setSelectedCategories([]);
  };

  // Clear all active filters (categories + space age)
  const clearAllFilters = () => {
    setPage(1);
    setSelectedCategories([]);
    setSpaceAgeFilter(false);
    onExpansionChange?.(null);
  };

  // Page change trigger
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // Responsive grid based on container width: max 3 columns even when sidebar is collapsed
  const gridClasses = "grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4";

  return (
    <div className="@container p-6 w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Explore Factorio Mods
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Search and discover mods directly from the official Factorio mod portal.
        </p>
      </div>

      {/* Controls Bar: Streamlined Search on left, Category Filter & View Mode Select on right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search mods by name, author, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-72 sm:w-96 md:w-[440px] text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            <span>Search</span>
          </Button>
        </form>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Multi-category & Expansion filter popover */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium cursor-pointer bg-background"
                >
                  <Filter className="size-3.5 text-muted-foreground" />
                  <span>Categories</span>
                  {(selectedCategories.length > 0 || spaceAgeFilter) && (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full ml-0.5"
                    >
                      {selectedCategories.length + (spaceAgeFilter ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-56 p-2 space-y-1.5">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40">
                <span className="text-xs font-semibold text-foreground">Filter Categories</span>
                {(selectedCategories.length > 0 || spaceAgeFilter) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={clearAllFilters}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Expansion Section (Space Age) - Displayed first before categories */}
              <div className="pt-0.5 pb-1 border-b border-border/40">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                  Expansion
                </div>
                <label className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs select-none transition-colors">
                  <Checkbox
                    checked={spaceAgeFilter}
                    onCheckedChange={toggleSpaceAge}
                  />
                  <Rocket className="size-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1">Space Age</span>
                </label>
              </div>

              {/* Categories Section */}
              <div className="space-y-0.5 max-h-56 overflow-y-auto pt-0.5">
                {CATEGORIES.map((cat) => {
                  const isChecked = selectedCategories.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs select-none transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleCategory(cat.id)}
                      />
                      <span className="flex-1 truncate">{cat.label}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* View Mode Select */}
          <Select
            value={viewMode}
            onValueChange={(val) => {
              if (val === "grid" || val === "list") setViewMode(val);
            }}
          >
            <SelectTrigger className="h-8 w-32 gap-1.5 cursor-pointer bg-background text-xs font-medium [&_svg]:size-3.5">
              <SelectValue>
                {viewMode === "grid" ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <LayoutGrid className="size-3.5" />
                    <span>Card View</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs">
                    <List className="size-3.5" />
                    <span>List View</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="text-xs min-w-32">
              <SelectItem value="grid" className="text-xs py-1.5 cursor-pointer">
                <LayoutGrid className="size-3.5" />
                <span className="text-xs">Card View</span>
              </SelectItem>
              <SelectItem value="list" className="text-xs py-1.5 cursor-pointer">
                <List className="size-3.5" />
                <span className="text-xs">List View</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filter Badges */}
      {(selectedCategories.length > 0 || spaceAgeFilter) && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-2">
          <span className="text-xs text-muted-foreground mr-1">Active filters:</span>
          {spaceAgeFilter && (
            <Badge
              variant="secondary"
              className="text-xs gap-1 font-normal cursor-pointer hover:bg-secondary/80 pl-2 pr-1.5 py-0.5 text-amber-500"
              onClick={toggleSpaceAge}
            >
              <Rocket className="size-3 text-amber-500" />
              <span>Space Age</span>
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </Badge>
          )}
          {selectedCategories.map((catId) => {
            const cat = CATEGORIES.find((c) => c.id === catId);
            return (
              <Badge
                key={catId}
                variant="secondary"
                className="text-xs gap-1 font-normal cursor-pointer hover:bg-secondary/80 pl-2 pr-1.5 py-0.5"
                onClick={() => toggleCategory(catId)}
              >
                <span>{cat?.label || catId}</span>
                <X className="size-3 text-muted-foreground hover:text-foreground" />
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="xs"
            onClick={clearAllFilters}
            className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive p-4 text-xs">
          {error}
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && results.length === 0 ? (
        viewMode === "grid" ? (
          <div className={gridClasses}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="size-12 rounded-lg shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <Skeleton className="size-12 rounded-lg shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 shrink-0" />
              </Card>
            ))}
          </div>
        )
      ) : results.length > 0 ? (
        /* Results View (Grid vs List) */
        viewMode === "grid" ? (
          <div className={gridClasses}>
            {results.map((item) => (
              <ModCard
                key={item.name}
                item={item}
                onDownload={onDownloadMod}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {results.map((item) => (
              <ModListItem
                key={item.name}
                item={item}
                onDownload={onDownloadMod}
              />
            ))}
          </div>
        )
      ) : (
        /* Empty State */
        !loading && (
          <Card className="border-dashed">
            <CardHeader className="text-center py-12">
              <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Package className="size-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-semibold">No mods found</CardTitle>
              <CardDescription className="max-w-md mx-auto text-xs text-muted-foreground">
                We couldn't find any mods matching "{submittedQuery || query}". Try a different keyword or check your spelling.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground order-2 sm:order-1">
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>

          <Pagination className="w-auto mx-0 justify-end order-1 sm:order-2">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  className={cn(
                    "cursor-pointer text-xs h-8",
                    (page <= 1 || loading) && "pointer-events-none opacity-50"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1 && !loading) handlePageChange(page - 1);
                  }}
                />
              </PaginationItem>

              {getPaginationItems(page, totalPages).map((item, idx) => {
                if (typeof item === "number") {
                  return (
                    <PaginationItem key={item}>
                      <PaginationLink
                        isActive={item === page}
                        className="cursor-pointer size-8 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                return (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis className="size-8" />
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  className={cn(
                    "cursor-pointer text-xs h-8",
                    (page >= totalPages || loading) && "pointer-events-none opacity-50"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages && !loading) handlePageChange(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
