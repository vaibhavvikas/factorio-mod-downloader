import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Download, Check, Sparkles, X, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Rocket, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../../context/AppContext';
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatCategoryLabel, getCategoryBadgeStyle, getCategoryPillStyle } from '../shared/modCategory';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT, INTERACTIVE } from '../../../theme/layers';
import { Tooltip, SummaryTooltip } from '../../ui/Tooltip';

export interface ModSearchResultItem {
    name: string;
    title: string;
    owner: string;
    summary: string;
    category: string;
    downloads_count: number;
    thumbnail?: string;
    latest_version: string;
    tags: string[];
    requires_space_age?: boolean;
}

interface SearchTabProps {
    existingModNames: string[];
    onAddModToQueue: (modName: string, goToQueue?: boolean) => Promise<void> | void;
}

const CATEGORY_FILTERS = [
    { id: 'all', label: 'All Categories' },
    { id: 'content', label: 'Content' },
    { id: 'overhaul', label: 'Overhaul' },
    { id: 'tweaks', label: 'Tweaks' },
    { id: 'utilities', label: 'Utilities' },
    { id: 'mod-packs', label: 'Mod packs' },
    { id: 'no-category', label: 'No Category' },
    { id: 'localizations', label: 'Localizations' },
    { id: 'scenarios', label: 'Scenarios' },
];

interface ModSearchResultCardProps {
    item: ModSearchResultItem;
    isAlreadyInQueue: boolean;
    addingModNames: Set<string>;
    onAddQueue: (modName: string) => void;
    onImageError: (modName: string) => void;
    hasImgError: boolean;
}

const TAG_PILL_CLASS =
    `panel-pill shrink-0 max-w-28 truncate ${TEXT.secondary} ${LAYER.summarySurface} ${BORDER.pill}`;
const TAG_COUNT_PILL_CLASS =
    `panel-pill shrink-0 whitespace-nowrap px-2 ${TEXT.secondary} ${LAYER.summarySurface} ${BORDER.pill}`;

const ModSearchResultCard: React.FC<ModSearchResultCardProps> = ({
    item,
    isAlreadyInQueue,
    addingModNames,
    onAddQueue,
    onImageError,
    hasImgError,
}) => {
    const lettersOnly = (item.title || item.name || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const initialLetter = lettersOnly ? lettersOnly[0].toUpperCase() : 'M';
    const categoryBadgeStyle = getCategoryBadgeStyle(item.category);

    const tagsRowRef = useRef<HTMLDivElement | null>(null);
    // null = not yet measured (all hidden; show zero pills to avoid FOUC). After first
    // measurement this becomes a concrete number of tags to visibly render.
    const [visibleTagCount, setVisibleTagCount] = useState<number | null>(null);

    // Decide how many tag pills / +N pill to render.
    useEffect(() => {
        const container = tagsRowRef.current;
        if (!container) return;

        let cancelled = false;
        let rafId = 0;

        const measure = () => {
            if (cancelled || !container) return;
            rafId = window.requestAnimationFrame(() => {
                if (cancelled || !container) return;
                const available = Math.max(0, container.clientWidth - 4);
                if (available <= 0) return;
                const children = Array.from(container.children) as HTMLElement[];
                const pillEls: HTMLElement[] = [];
                let countPillEl: HTMLElement | null = null;
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (child.dataset.countPill === 'true') {
                        countPillEl = child;
                    } else {
                        pillEls.push(child);
                    }
                }

                const gapPx = 6; // gap-1.5 = 6px
                const countPillW = countPillEl ? countPillEl.getBoundingClientRect().width : 0;

                // Pass 1: measure every pill once, and compute whether all tags fit
                // without any +N count pill. If yes, show everything.
                const total = pillEls.length;
                const widths: number[] = new Array(total);
                let allFitWidth = 0;
                for (let i = 0; i < total; i++) {
                    const w = pillEls[i].getBoundingClientRect().width;
                    widths[i] = w;
                    allFitWidth += (i === 0 ? 0 : gapPx) + w;
                }

                let fitCount: number;
                if (total === 0) {
                    fitCount = 0;
                } else if (allFitWidth <= available) {
                    // All tags fit cleanly with no count pill — render the full set.
                    fitCount = total;
                } else {
                    // Pass 2: greedy fit, reserving room for a gap + the +N count pill
                    // once, after the last tag we decide to show.
                    let used = 0;
                    fitCount = 0;
                    for (let i = 0; i < total; i++) {
                        const w = widths[i];
                        const gapBefore = fitCount === 0 ? 0 : gapPx;
                        // Because we already know we can't fit all tags, a +N pill
                        // will be appended; reserve one gap + countPill width on
                        // top of this pill's own footprint.
                        const reserveAfter = gapPx + countPillW;
                        const required = gapBefore + w + reserveAfter;
                        if (used + required > available) break;
                        used += gapBefore + w;
                        fitCount += 1;
                    }
                    // Safety fallback: if even one tag + count pill won't fit, try
                    // to show at least the first tag so we never render an empty
                    // tag row when tags actually exist.
                    if (fitCount === 0) {
                        const w0 = widths[0];
                        if (w0 + gapPx + countPillW <= available) {
                            fitCount = 1;
                        } else if (w0 <= available) {
                            fitCount = 1;
                        }
                    }
                }
                setVisibleTagCount(fitCount);
            });
        };

        const ro = new ResizeObserver(() => {
            if (rafId) window.cancelAnimationFrame(rafId);
            measure();
        });
        ro.observe(container);
        measure();

        return () => {
            cancelled = true;
            if (rafId) window.cancelAnimationFrame(rafId);
            ro.disconnect();
        };
        // Re-measure when tags length changes or queue state changes; different mods re-mount via key.
    }, [item.tags.length, isAlreadyInQueue]);

    // Decide how many tag pills / +N pill to render.
    // While visibleTagCount === null (first paint before measurement), render ALL tags + a
    // temporary +N pill so measurement has real widths, but keep the row opacity-0 to avoid FOUC.
    const totalTags = item.tags.length;
    const duringInitialRender = visibleTagCount === null;
    const fitCount = duringInitialRender ? totalTags : Math.max(0, Math.min(visibleTagCount ?? 0, totalTags));
    const overflowCount = totalTags - fitCount;
    const needsCountPill = duringInitialRender || overflowCount > 0;
    const visibleTags = duringInitialRender ? item.tags : item.tags.slice(0, fitCount);
    // During initial measurement use +99 as a wide-placeholder so small counts still reserve space.
    const finalOverflowCount = duringInitialRender ? 99 : overflowCount;

    const hiddenTags = needsCountPill && !duringInitialRender ? item.tags.slice(fitCount).join(', ') : '';

    return (
        <div
            className={`relative self-start ${LAYER.contentCard} ${BORDER.card} rounded-2xl p-3 shadow-xs hover:z-10 ${HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200 flex flex-col gap-2.5`}
        >
            <div className="flex min-h-12 items-center gap-2.5">
                {item.thumbnail && !hasImgError ? (
                    <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0"
                        onError={() => onImageError(item.name)}
                    />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 dark:bg-blue-500/25 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg shrink-0 select-none shadow-xs">
                        {initialLetter}
                    </div>
                )}

                <div className="flex flex-col justify-center min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h4 className="min-w-0 flex-1 text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.title || item.name}
                        </h4>
                        {item.requires_space_age && (
                            <span className="panel-pill shrink-0 border border-orange-500/50 dark:border-orange-400/50 bg-transparent text-orange-600 dark:text-orange-400 flex items-center gap-1 font-bold">
                                <Rocket className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            </span>
                        )}
                        <span className={`panel-pill shrink-0 tracking-wide border ${categoryBadgeStyle}`}>
                            {formatCategoryLabel(item.category)}
                        </span>
                    </div>

                    <div className={`flex items-center gap-2 text-xs ${TEXT.secondary} mt-1 flex-wrap`}>
                        <span>by <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{item.owner}</strong></span>
                        {item.downloads_count > 0 && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Download className="w-2.5 h-2.5 text-slate-400" />
                                    {item.downloads_count.toLocaleString()}
                                </span>
                            </>
                        )}
                        {item.latest_version && (
                            <>
                                <span>•</span>
                                <span className="font-mono text-xs">v{item.latest_version}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <SummaryTooltip content={item.summary || 'No summary available.'}>
                <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2-custom m-0 p-0">
                    {item.summary || 'No summary available.'}
                </p>
            </SummaryTooltip>

            <div className="flex min-w-0 items-center justify-between gap-3">
                <div
                    ref={tagsRowRef}
                    className={`flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden ${duringInitialRender ? 'opacity-0' : 'opacity-100 transition-opacity duration-100'}`}
                >
                    {visibleTags.map(tag => (
                        <span key={tag} className={TAG_PILL_CLASS}>
                            {tag}
                        </span>
                    ))}
                    {needsCountPill && (
                        <div key="__count_pill__" data-count-pill="true" className="shrink-0">
                            <Tooltip content={hiddenTags} disabled={duringInitialRender}>
                                <span className={TAG_COUNT_PILL_CLASS}>
                                    +{finalOverflowCount}
                                </span>
                            </Tooltip>
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <Tooltip content="Open on Mod Portal">
                        <a
                            href={`https://mods.factorio.com/mod/${item.name}`}
                            onClick={async (event) => {
                                event.preventDefault();
                                await openUrl(`https://mods.factorio.com/mod/${item.name}`);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-blue-400 block"
                            aria-label={`View ${item.title || item.name} on Mod Portal`}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </Tooltip>
                    {isAlreadyInQueue ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5 select-none">
                            <Check className="w-3.5 h-3.5" />
                            <span>Queued</span>
                        </span>
                    ) : (
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onAddQueue(item.name);
                            }}
                            disabled={addingModNames.has(item.name)}
                            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                            {addingModNames.has(item.name) ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <span>+ Add</span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};



interface ModBrowseResponse {
    results: ModSearchResultItem[];
    page: number;
    total_pages: number;
}

export const SearchTab: React.FC<SearchTabProps> = ({
    existingModNames,
    onAddModToQueue,
}) => {
    const { addLog, factorioVersion } = useAppContext();
    const addLogRef = useRef(addLog);
    const resultsScrollRef = useRef<HTMLDivElement>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [spaceAgeFilter, setSpaceAgeFilter] = useState(false);
    const [addingModNames, setAddingModNames] = useState<Set<string>>(() => new Set());
    const addingModNamesRef = useRef<Set<string>>(new Set());
    const [results, setResults] = useState<ModSearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [reloadTrigger, setReloadTrigger] = useState(0);

    useEffect(() => {
        addLogRef.current = addLog;
    }, [addLog]);

    useEffect(() => {
        const element = categoryScrollRef.current;
        if (!element) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                element.scrollLeft += e.deltaY;
            }
        };

        element.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, []);

    useEffect(() => {
        resultsScrollRef.current?.scrollTo({ top: 0 });
    }, [query, selectedCategories, spaceAgeFilter, page]);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const trimmed = query.trim();
                const res = await invoke<ModBrowseResponse>('browse_mods', {
                    query: trimmed || null,
                    category: null,
                    categories: selectedCategories.length > 0 ? selectedCategories : null,
                    expansion: spaceAgeFilter ? 'space-age' : null,
                    factorioVersion: factorioVersion === 'any' || factorioVersion === 'all' ? null : factorioVersion,
                    page,
                });
                if (cancelled) return;
                setResults(res.results);
                setTotalPages(Math.max(1, res.total_pages));
            } catch (err: any) {
                if (cancelled) return;
                addLogRef.current(`Search failed: ${err?.toString() || 'Unknown error'}`, 'error');
                setResults([]);
                setTotalPages(1);
            }
            if (!cancelled) setLoading(false);
        }, query.trim() ? 300 : 0);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, selectedCategories, spaceAgeFilter, factorioVersion, page, reloadTrigger]);

    const handleToggleCategory = (catId: string) => {
        setPage(1);
        if (catId === 'all') {
            setSelectedCategories([]);
            return;
        }
        setSelectedCategories(prev =>
            prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
        );
    };

    const handleAddQueue = async (modName: string) => {
        if (addingModNamesRef.current.has(modName)) return;
        addingModNamesRef.current.add(modName);
        setAddingModNames(new Set(addingModNamesRef.current));

        try {
            await onAddModToQueue(modName, false);
        } finally {
            addingModNamesRef.current.delete(modName);
            setAddingModNames(new Set(addingModNamesRef.current));
        }
    };

    const paginationItems: Array<number | 'ellipsis-left' | 'ellipsis-right'> = (() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, index) => index + 1);
        }
        if (page <= 4) {
            return [1, 2, 3, 4, 5, 6, 'ellipsis-right', totalPages];
        }
        if (page >= totalPages - 3) {
            return [1, 'ellipsis-left', totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', totalPages];
    })();

    return (
        <div className={`relative h-full min-h-0 flex flex-col gap-4 px-3 pt-3 pb-2 ${LAYER.appCanvas}`}>
            {/* Top Search Bar & Category Filter Pills */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className={`flex h-10 ${LAYER.toolbar} ${BORDER.toolbar} rounded-xl pl-3.5 pr-1.5 py-1.5 items-center gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all shadow-xs`}>
                    <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search Factorio mods by title, author, or keyword (e.g. Krastorio, Space Exploration, Bob...)"
                        className="bg-transparent border-none text-xs text-slate-800 dark:text-zinc-100 focus:outline-none w-full font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    />
                    {query.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                setPage(1);
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}



                    {/* Reload Mods Button */}
                    <button
                        type="button"
                        onClick={() => setReloadTrigger(prev => prev + 1)}
                        disabled={loading}
                        aria-label="Reload mod results"
                        className={`h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg ${INTERACTIVE.secondary} ${BORDER.inner} shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
                    </button>
                </div>

                <div className="relative min-w-0 flex items-center gap-2">
                    {/* Space Age Expansion Toggle Pill */}
                    <button
                        type="button"
                        onClick={() => {
                            setSpaceAgeFilter(!spaceAgeFilter);
                            setPage(1);
                        }}
                        className={`shrink-0 h-7.5 px-3.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 select-none ${spaceAgeFilter
                            ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white border-orange-400 shadow-xs'
                            : `${LAYER.contentCard} text-slate-700 dark:text-zinc-300 ${BORDER.card} hover:bg-slate-50 dark:hover:bg-zinc-800/60`
                            }`}
                    >
                        <Rocket className={`w-3.5 h-3.5 ${spaceAgeFilter ? 'text-white' : 'text-orange-500'}`} />
                        <span>Space Age</span>
                    </button>

                    <div className="h-4 w-px bg-slate-300 dark:bg-zinc-800 shrink-0" />

                    <div
                        ref={categoryScrollRef}
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        className="flex items-center gap-1.5 overflow-x-auto text-xs select-none min-w-0 flex-1 py-0.5 [::-webkit-scrollbar]:hidden"
                    >
                        {CATEGORY_FILTERS.map(cat => {
                            const isSelected = cat.id === 'all'
                                ? selectedCategories.length === 0
                                : selectedCategories.includes(cat.id);
                            const pillStyle = getCategoryPillStyle(cat.id, isSelected);

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => handleToggleCategory(cat.id)}
                                    className={`shrink-0 h-7.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${pillStyle}`}
                                >
                                    <span>{cat.label}</span>
                                    {isSelected && cat.id !== 'all' && (
                                        <X className="w-3 h-3 text-white/80 hover:text-white" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedCategories.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCategories([]);
                                setPage(1);
                            }}
                            className="shrink-0 h-7.5 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Reset ({selectedCategories.length})</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="relative flex flex-col flex-1 min-h-0">
                <div className={`relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl ${BORDER.outer} ${LAYER.viewportGlass}`}>
                    <div className="relative flex-1 min-h-0">
                        <div ref={resultsScrollRef} className="scroller-panel card h-full">
                            {results.length === 0 && !loading ? (
                                <div className="text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                                    <div className="p-4 rounded-full bg-slate-200/50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-blue-500">
                                        <Sparkles className="w-8 h-8 stroke-[1.2]" />
                                    </div>
                                    <div className="flex flex-col gap-1 max-w-[300px] text-center select-none">
                                        <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">
                                            {query.trim() ? `No mods matching "${query}"` : 'No mods found for selected filters'}
                                        </span>
                                        <span className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
                                            Explore thousands of community mods directly from the Factorio Mod Portal.
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {results.map(item => {
                                        const isAlreadyInQueue = existingModNames.includes(item.name);
                                        return (
                                            <ModSearchResultCard
                                                key={item.name}
                                                item={item}
                                                isAlreadyInQueue={isAlreadyInQueue}
                                                addingModNames={addingModNames}
                                                onAddQueue={handleAddQueue}
                                                onImageError={(name) => setImgErrors(prev => ({ ...prev, [name]: true }))}
                                                hasImgError={!!imgErrors[item.name]}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/15 dark:bg-black/25 pointer-events-auto cursor-wait">
                                <div className={`flex items-center gap-2 rounded-xl ${BORDER.cardSoft} ${LAYER.floatingPanel} px-3 py-2 shadow-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-200`}>
                                    <span className="loading-bars" aria-hidden="true"><i /><i /><i /></span>
                                    Loading mods…
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pagination footer — always rendered at a fixed height to avoid layout
                        shift when search results return only 1 page. "Page 1 of 1" + disabled
                        nav gives the same stable visual footprint as multi-page navigation. */}
                    <div className={`shrink-0 min-h-[40px] border-t ${DIVIDER.outer} ${LAYER.viewportFooter} px-3 py-2 flex items-center justify-between text-xs select-none`}>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                            Page <strong className="font-bold text-slate-700 dark:text-zinc-200">{page}</strong> of <strong className="font-bold text-slate-700 dark:text-zinc-200">{totalPages}</strong>
                        </div>

                        <nav className="flex items-center gap-1" aria-label="Mod results pagination">
                            <button
                                type="button"
                                onClick={() => setPage(current => Math.max(1, current - 1))}
                                disabled={page === 1 || loading || totalPages <= 1}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg ${BORDER.card} ${LAYER.contentCard} text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer`}
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            {totalPages <= 1 ? (
                                // Single-page: one fixed page-1 pill (active + visually disabled)
                                // so the button-row footprint and height are identical to multi-page.
                                <span
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] font-bold bg-blue-600 border-blue-600 text-white shadow-xs opacity-80 cursor-default select-none"
                                    aria-current="page"
                                >
                                    1
                                </span>
                            ) : (
                                paginationItems.map(item => typeof item === 'number' ? (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setPage(item)}
                                        disabled={loading}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] font-bold transition-all duration-200 animate-in fade-in zoom-in-95 cursor-pointer disabled:cursor-not-allowed ${page === item
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs scale-105'
                                            : `${LAYER.contentCard} ${BORDER.card} text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800`
                                            }`}
                                    >
                                        {item}
                                    </button>
                                ) : (
                                    <span key={item} className="w-7 h-7 flex items-center justify-center text-center text-slate-400 dark:text-zinc-500 select-none transition-all duration-200 animate-in fade-in">…</span>
                                ))
                            )}
                            <button
                                type="button"
                                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                                disabled={page === totalPages || loading || totalPages <= 1}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg ${BORDER.card} ${LAYER.contentCard} text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer`}
                                aria-label="Next page"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Mod details side panel / drawer */}
            </div>
        </div>
    );
};
