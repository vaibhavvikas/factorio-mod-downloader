import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Download, Check, Sparkles, X, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, RefreshCw, Rocket, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../context/AppContext';
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatCategoryLabel, getCategoryBadgeStyle, getCategoryPillStyle } from './modCategory';

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

const FACTORIO_VERSIONS = [
    { value: '2.1', label: '2.1' },
    { value: '2.0', label: '2.0' },
    { value: '1.1', label: '1.1' },
    { value: '1.0', label: '1.0' },
    { value: '0.18', label: '0.18' },
    { value: '0.17', label: '0.17' },
    { value: '0.16', label: '0.16' },
    { value: '0.15', label: '0.15' },
    { value: '0.14', label: '0.14' },
    { value: '0.13', label: '0.13' },
    { value: 'any', label: 'Any' },
];

const FactorioVersionDropdown: React.FC<{
    value: string;
    onChange: (val: string) => void;
}> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeItem = FACTORIO_VERSIONS.find(v => v.value === value) || FACTORIO_VERSIONS.find(v => v.value === '2.0') || FACTORIO_VERSIONS[0];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="relative shrink-0 select-none">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex h-7 w-[165px] items-center justify-between px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                title="Filter mods by target Factorio version"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 shrink-0">Factorio Version:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">{activeItem.label}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-md max-h-60 overflow-y-auto">
                    {FACTORIO_VERSIONS.map((item) => {
                        const isSelected = value === item.value;
                        return (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                    onChange(item.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                                    isSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/70 font-medium'
                                }`}
                            >
                                <span>{item.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                            </button>
                        );
                    })}
                </div>
            )}
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
    const { addLog, factorioVersion, setFactorioVersion } = useAppContext();
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
        <div className="relative h-full min-h-0 flex flex-col gap-4 px-4 pt-3 pb-2 bg-slate-100 dark:bg-zinc-950">
            {/* Top Search Bar & Category Filter Pills */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex h-10 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-1.5 py-1.5 items-center gap-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-xs">
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
                            title="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 shrink-0 mx-0.5" />

                    {/* Embedded Factorio Version Dropdown */}
                    <FactorioVersionDropdown
                        value={factorioVersion}
                        onChange={(v) => {
                            setFactorioVersion(v);
                            setPage(1);
                        }}
                    />

                    {/* Reload Mods Button */}
                    <button
                        type="button"
                        onClick={() => setReloadTrigger(prev => prev + 1)}
                        disabled={loading}
                        className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/80 shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        title="Reload mod results"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
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
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
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
                            title="Reset all selected categories"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Reset ({selectedCategories.length})</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="relative flex flex-col flex-1 min-h-0">
                <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-white/40 dark:bg-zinc-900/30">
                    <div className="relative flex-1 min-h-0">
                        <div ref={resultsScrollRef} className="h-full overflow-y-auto p-4">
                            {results.length === 0 && !loading ? (
                                <div className="text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                                    <div className="p-4 rounded-full bg-slate-200/50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-indigo-500">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {results.map(item => {
                                        const isAlreadyInQueue = existingModNames.includes(item.name);
                                        const lettersOnly = (item.title || item.name || '').replace(/[^a-zA-Z\s]/g, '').trim();
                                        const initialLetter = lettersOnly ? lettersOnly[0].toUpperCase() : 'M';
                                        const visibleTags = item.tags.slice(0, 3);
                                        const hiddenTagCount = Math.max(0, item.tags.length - visibleTags.length);
                                        const categoryBadgeStyle = getCategoryBadgeStyle(item.category);

                                        return (
                                            <div
                                                key={item.name}
                                                className="relative self-start bg-white dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl p-4 shadow-xs hover:z-10 hover:border-slate-300 dark:hover:border-zinc-700/80 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
                                            >
                                                <div className="flex min-h-12 items-center gap-3">
                                                    {item.thumbnail && !imgErrors[item.name] ? (
                                                        <img
                                                            src={item.thumbnail}
                                                            alt={item.title}
                                                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0"
                                                            onError={() => setImgErrors(prev => ({ ...prev, [item.name]: true }))}
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shrink-0 select-none shadow-xs">
                                                            {initialLetter}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col justify-center min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            <h4 className="min-w-0 flex-1 text-sm font-bold text-slate-900 dark:text-white truncate" title={item.title || item.name}>
                                                                {item.title || item.name}
                                                            </h4>
                                                            {item.requires_space_age && (
                                                                <span className="panel-pill shrink-0 border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center gap-1 font-bold" title="Requires Factorio: Space Age">
                                                                    <Rocket className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                                                </span>
                                                            )}
                                                            <span className={`panel-pill shrink-0 tracking-wide border ${categoryBadgeStyle}`}>
                                                                {formatCategoryLabel(item.category)}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
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

                                                <div className="group relative min-h-12 flex items-center bg-slate-50/60 dark:bg-zinc-950/40 p-2 rounded-xl border border-slate-200/40 dark:border-zinc-800/40">
                                                    <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2-custom m-0 p-0">
                                                        {item.summary || 'No summary available.'}
                                                    </p>
                                                    {item.summary && (
                                                        <div className="pointer-events-none absolute z-20 left-0 right-0 top-full mt-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300 shadow-lg opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                                            {item.summary}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex min-w-0 items-center justify-between gap-3">
                                                    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden">
                                                        {visibleTags.map(tag => (
                                                            <span key={tag} className="panel-pill shrink-0 max-w-28 truncate text-slate-600 dark:text-zinc-400 bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {hiddenTagCount > 0 && (
                                                            <span className="panel-pill shrink-0 text-slate-500 dark:text-zinc-400 bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700">
                                                                +{hiddenTagCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        <a
                                                            href={`https://mods.factorio.com/mod/${item.name}`}
                                                            onClick={async (event) => {
                                                                event.preventDefault();
                                                                await openUrl(`https://mods.factorio.com/mod/${item.name}`);
                                                            }}
                                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                                                            aria-label={`View ${item.title || item.name} on Mod Portal`}
                                                            title="View on Mod Portal"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                        {isAlreadyInQueue ? (
                                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5 select-none">
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Queued</span>
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleAddQueue(item.name);
                                                                }}
                                                                disabled={addingModNames.has(item.name)}
                                                                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
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
                                    })}
                                </div>
                            )}
                        </div>

                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/15 dark:bg-black/25 pointer-events-auto cursor-wait">
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-3 py-2 shadow-lg text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                                    <span className="loading-bars" aria-hidden="true"><i /><i /><i /></span>
                                    Loading mods…
                                </div>
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="shrink-0 border-t border-slate-200/90 dark:border-zinc-800/90 bg-white/90 dark:bg-zinc-900/90 px-4 py-2.5 flex items-center justify-between text-xs select-none">
                            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                                Page <strong className="font-bold text-slate-700 dark:text-zinc-200">{page}</strong> of <strong className="font-bold text-slate-700 dark:text-zinc-200">{totalPages}</strong>
                            </div>

                            <nav className="flex items-center gap-1" aria-label="Mod results pagination">
                                <button
                                    type="button"
                                    onClick={() => setPage(current => Math.max(1, current - 1))}
                                    disabled={page === 1 || loading}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                {paginationItems.map(item => typeof item === 'number' ? (
                                    <button 
                                        key={item} 
                                        type="button" 
                                        onClick={() => setPage(item)} 
                                        disabled={loading} 
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] font-bold transition-all duration-200 animate-in fade-in zoom-in-95 cursor-pointer disabled:cursor-not-allowed ${
                                            page === item 
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs scale-105' 
                                                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                ) : (
                                    <span key={item} className="w-7 h-7 flex items-center justify-center text-center text-slate-400 dark:text-zinc-500 select-none transition-all duration-200 animate-in fade-in">…</span>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                                    disabled={page === totalPages || loading}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </nav>
                        </div>
                    )}
                </div>

                {/* Mod details side panel / drawer */}
            </div>
        </div>
    );
};
