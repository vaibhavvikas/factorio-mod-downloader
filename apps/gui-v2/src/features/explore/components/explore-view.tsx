import * as React from "react"
import {
  Search,
  Loader2,
  Package,
  Compass,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Filter,
  X,
  Rocket,
  Gamepad2,
} from "lucide-react"
import { useExploreStore } from "@/stores/use-explore-store"
import { useSettingsStore, DEFAULT_FACTORIO_VERSIONS } from "@/stores/use-settings-store"
import { useModsQuery } from "../api/use-mods-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Field } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
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

// Calculate initial skeletons based on screen height (12 for standard 3-column height, max 20)
function getInitialSkeletonCount(): number {
  if (typeof window === "undefined") return 12;
  const height = window.innerHeight || 850;
  // Account for header, titlebar and controls bar (~100px); each card row is ~200px
  const rows = Math.max(3, Math.ceil((height - 100) / 200));
  return Math.min(20, Math.max(6, rows * 3));
}

export function ExploreView({
  selectedCategory = null,
  selectedExpansion = null,
  selectedVersion = null,
  onExpansionChange,
  onVersionChange,
  onDownloadMod,
}: ExploreViewProps) {
  // Global persisted state via Zustand
  const query = useExploreStore((s) => s.query);
  const setQuery = useExploreStore((s) => s.setQuery);
  const submittedQuery = useExploreStore((s) => s.submittedQuery);
  const setSubmittedQuery = useExploreStore((s) => s.setSubmittedQuery);
  const selectedCategories = useExploreStore((s) => s.selectedCategories);
  const setSelectedCategories = useExploreStore((s) => s.setSelectedCategories);
  const spaceAgeFilter = useExploreStore((s) => s.spaceAgeFilter);
  const setSpaceAgeFilter = useExploreStore((s) => s.setSpaceAgeFilter);
  const viewMode = useExploreStore((s) => s.viewMode);
  const setViewMode = useExploreStore((s) => s.setViewMode);
  const page = useExploreStore((s) => s.page);
  const setPage = useExploreStore((s) => s.setPage);

  // Global Factorio version filter from settings store
  const storeFactorioVersion = useSettingsStore((s) => s.factorioVersion);
  const effectiveVersion =
    selectedVersion ??
    (storeFactorioVersion === "any" || storeFactorioVersion === "all"
      ? null
      : storeFactorioVersion);

  // Reset page when Factorio version filter changes
  React.useEffect(() => {
    setPage(1);
  }, [effectiveVersion, setPage]);

  // Cached API query via TanStack Query
  const {
    data: queryData,
    isLoading,
    isFetching,
    isPlaceholderData,
    error: queryError,
  } = useModsQuery({
    query: submittedQuery,
    categories: selectedCategories,
    expansion: spaceAgeFilter ? "space-age" : null,
    factorioVersion: effectiveVersion,
    page,
  });

  // Local display state for transition orchestration
  const [displayedResults, setDisplayedResults] = React.useState<ModSearchResultItem[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isPageTransitioning, setIsPageTransitioning] = React.useState(false);
  const [fadeKey, setFadeKey] = React.useState(0);
  const [initialSkeletonCount, setInitialSkeletonCount] = React.useState(getInitialSkeletonCount);

  // Recalculate skeleton count if window is resized while initial load is happening
  React.useEffect(() => {
    const handleResize = () => setInitialSkeletonCount(getInitialSkeletonCount());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pageTransitionTimerRef = React.useRef<number | null>(null);
  const isWaitingFor300msRef = React.useRef(false);
  const pendingDataRef = React.useRef<ModSearchResponse | null>(null);

  // Clear timers on unmount
  React.useEffect(() => {
    return () => {
      if (pageTransitionTimerRef.current !== null) {
        window.clearTimeout(pageTransitionTimerRef.current);
      }
    };
  }, []);

  // Sync external category & expansion props if passed
  React.useEffect(() => {
    if (selectedCategory && !selectedCategories.includes(selectedCategory)) {
      setSelectedCategories([selectedCategory]);
    }
    if (selectedExpansion && !spaceAgeFilter) {
      setSpaceAgeFilter(selectedExpansion === "space-age");
    }
  }, [
    selectedCategory,
    selectedExpansion,
    selectedCategories,
    spaceAgeFilter,
    setSelectedCategories,
    setSpaceAgeFilter,
  ]);

  // Sync incoming TanStack Query data into displayed results
  React.useEffect(() => {
    if (!queryData || isPlaceholderData) return;
    // Ignore superseded responses if target page has moved on
    if (queryData.page && queryData.page !== page) return;

    if (isWaitingFor300msRef.current) {
      // Data arrived during the 300ms scroll: buffer it to avoid layout jumps
      pendingDataRef.current = queryData;
    } else {
      // Data arrived at/after 300ms or on normal search/filter
      setDisplayedResults(queryData.results || []);
      setTotalPages(Math.max(1, queryData.total_pages || 1));
      setIsPageTransitioning(false);
      setFadeKey((prev) => prev + 1);
    }
  }, [queryData, isPlaceholderData, page]);

  const errorMessage = queryError
    ? (queryError as any).message || String(queryError)
    : null;

  // Helper to cleanly cancel any ongoing pagination transition
  const cancelPageTransition = React.useCallback(() => {
    if (pageTransitionTimerRef.current !== null) {
      window.clearTimeout(pageTransitionTimerRef.current);
      pageTransitionTimerRef.current = null;
    }
    isWaitingFor300msRef.current = false;
    pendingDataRef.current = null;
    setIsPageTransitioning(false);
  }, []);

  // Search only on Enter or clicking the search button
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    cancelPageTransition();
    setPage(1);
    setSubmittedQuery(query);
  };

  // Toggle Space Age filter
  const toggleSpaceAge = () => {
    cancelPageTransition();
    setPage(1);
    setSpaceAgeFilter((prev) => {
      const next = !prev;
      onExpansionChange?.(next ? "space-age" : null);
      return next;
    });
  };

  // Toggle category in multi-select
  const toggleCategory = (catId: string) => {
    cancelPageTransition();
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  // Clear all categories
  const clearCategories = () => {
    cancelPageTransition();
    setPage(1);
    setSelectedCategories([]);
  };

  // Clear all active filters (categories + space age)
  const clearAllFilters = () => {
    cancelPageTransition();
    setPage(1);
    setSelectedCategories([]);
    setSpaceAgeFilter(false);
    onExpansionChange?.(null);
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollAnimRef = React.useRef<number | null>(null);

  // Smooth scroll to top of scrollable container using requestAnimationFrame with easeInOutCubic
  const scrollToTop = React.useCallback((duration = 300) => {
    const viewport = containerRef.current?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    const target =
      viewport && viewport.scrollHeight > viewport.clientHeight
        ? viewport
        : (document.scrollingElement as HTMLElement) || document.documentElement;

    if (!target) return;

    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    const start = target.scrollTop;
    if (start <= 0) return;

    const startTime = performance.now();
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const cancelOnUserInteraction = () => {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };

    target.addEventListener("wheel", cancelOnUserInteraction, { passive: true, once: true });
    target.addEventListener("touchstart", cancelOnUserInteraction, { passive: true, once: true });

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      target.scrollTop = Math.round(start * (1 - eased));

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        target.scrollTop = 0;
        scrollAnimRef.current = null;
        target.removeEventListener("wheel", cancelOnUserInteraction);
        target.removeEventListener("touchstart", cancelOnUserInteraction);
      }
    };

    scrollAnimRef.current = requestAnimationFrame(step);
  }, []);

  // Cancel any running animation on unmount
  React.useEffect(() => {
    return () => {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
      }
    };
  }, []);

  // Page change trigger:
  // 1. Click (0ms): highlight target page, dim old grid slightly, start fetch
  // 2. 0 to 300ms: smooth-scroll to top over old grid
  // 3. When data arrives (at or after 300ms): fade real cards in
  const handlePageChange = (targetPage: number) => {
    const clampedPage = Math.min(totalPages, Math.max(1, targetPage));
    const currentPage = useExploreStore.getState().page;
    if (clampedPage === currentPage) return;

    cancelPageTransition();

    // Click (0ms):
    // - Highlight target page
    setPage(clampedPage);
    // - Dim old grid slightly & mark waiting period
    setIsPageTransitioning(true);
    isWaitingFor300msRef.current = true;

    // 0 to 300ms: Smooth-scroll to top over old grid
    scrollToTop(300);

    // At 300ms:
    pageTransitionTimerRef.current = window.setTimeout(() => {
      isWaitingFor300msRef.current = false;
      pageTransitionTimerRef.current = null;

      if (pendingDataRef.current) {
        // Data ready by 300ms: fade real cards in
        const res = pendingDataRef.current;
        pendingDataRef.current = null;
        setDisplayedResults(res.results || []);
        setTotalPages(Math.max(1, res.total_pages || 1));
        setIsPageTransitioning(false);
        setFadeKey((prev) => prev + 1);
      }
      // If data is not ready yet, keep the dimmed old grid until data arrives
    }, 300);
  };

  // Responsive grid based on container width: max 3 columns even when sidebar is collapsed
  const gridClasses = "grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4";
  const digits = String(totalPages).length;

  return (
    <div ref={containerRef} className="@container p-6 w-full max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Compass className="size-6 text-primary shrink-0" />
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
            disabled={isFetching}
            className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            <span>Search</span>
          </Button>
        </form>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Quick Pagination Indicator & Pager */}
          {totalPages > 1 && (
            <nav
              role="navigation"
              aria-label="Quick pagination"
              className="hidden sm:flex items-center gap-0.5 select-none text-muted-foreground"
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-foreground hover:bg-muted/50 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                disabled={page <= 1}
                onClick={() => handlePageChange(useExploreStore.getState().page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div
                className="text-xs tabular-nums text-center px-1 min-w-[var(--w-compact)] md:min-w-[var(--w-full)]"
                style={{
                  "--w-full": `${9 + 2 * digits}ch`,
                  "--w-compact": `${3 + 2 * digits}ch`,
                } as React.CSSProperties}
                aria-live="polite"
              >
                <span className="hidden md:inline">
                  Page <span className="font-medium text-foreground">{page}</span> of{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <span className="inline md:hidden">
                  <span className="font-medium text-foreground">{page}</span> /{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-foreground hover:bg-muted/50 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(useExploreStore.getState().page + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </nav>
          )}

          {/* Inline Factorio Version Selector */}
          <Select
            value={storeFactorioVersion || "2.1"}
            onValueChange={(val) => {
              if (val) {
                useSettingsStore.getState().setFactorioVersion(val);
                onVersionChange?.(val === "any" ? null : val);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs font-medium border-border/80 px-2.5 gap-2 cursor-pointer">
              <Gamepad2 className="size-3.5 shrink-0" />
              <SelectValue placeholder="Factorio Version" />
            </SelectTrigger>
            <SelectContent align="end" className="font-mono text-xs min-w-(--anchor-width) w-auto">
              {DEFAULT_FACTORIO_VERSIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs py-1.5 pl-2.5 pr-8 cursor-pointer">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Multi-category & Expansion filter popover */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
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
              <ScrollArea className="h-56 pr-1 pt-0.5">
                <div className="space-y-0.5 pr-1.5">
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
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0 cursor-pointer"
              onClick={() => setViewMode("grid")}
              title="Card View"
              aria-label="Card View"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0 cursor-pointer"
              onClick={() => setViewMode("list")}
              title="List View"
              aria-label="List View"
            >
              <List className="size-3.5" />
            </Button>
          </div>
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
          {(selectedCategories.length > 0 || spaceAgeFilter) && (
            <Button
              variant="ghost"
              size="xs"
              onClick={clearAllFilters}
              className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive p-4 text-xs">
          {errorMessage}
        </Card>
      )}

      {/* Loading Skeleton (Initial Load) */}
      {isLoading && displayedResults.length === 0 ? (
        viewMode === "grid" ? (
          <div className={gridClasses}>
            {Array.from({ length: initialSkeletonCount }).map((_, i) => (
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
            {Array.from({ length: initialSkeletonCount }).map((_, i) => (
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
      ) : displayedResults.length > 0 ? (
        /* Results View (Grid vs List) */
        viewMode === "grid" ? (
          <div
            key={fadeKey}
            className={cn(
              gridClasses,
              isPageTransitioning
                ? "opacity-20 pointer-events-none transition-opacity duration-300"
                : "animate-cards-fade-in"
            )}
          >
            {displayedResults.map((item) => (
              <ModCard
                key={item.name}
                item={item}
                onDownload={onDownloadMod}
              />
            ))}
          </div>
        ) : (
          <div
            key={fadeKey}
            className={cn(
              "flex flex-col gap-2.5",
              isPageTransitioning
                ? "opacity-20 pointer-events-none transition-opacity duration-300"
                : "animate-cards-fade-in"
            )}
          >
            {displayedResults.map((item) => (
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
        !isLoading &&
        !isFetching && (
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
                    page <= 1 && "pointer-events-none opacity-50"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(useExploreStore.getState().page - 1);
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
                    page >= totalPages && "pointer-events-none opacity-50"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(useExploreStore.getState().page + 1);
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
