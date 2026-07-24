import React from 'react';
import { Loader2, RefreshCw, ExternalLink, ArrowRight, CheckSquare, Square } from 'lucide-react';
import type { InstalledModItem, DownloadTask } from '../../../context/AppContext';
import { Checkbox } from '../../ui/Checkbox';
import { LAYER, BORDER, HOVER_BORDER, TEXT } from '../../../theme/layers';
import { InstalledVersionDropdown } from './InstalledVersionDropdown';

const getInitials = (title: string): string => {
    if (!title) return 'MD';
    const cleaned = title.replace(/[^a-zA-Z\s]/g, '').trim();
    if (!cleaned) return 'MD';
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
};

interface InstalledUpdatesListProps {
    mods: InstalledModItem[];
    queue: DownloadTask[];
    isCheckingUpdates: boolean;
    isAnyLoading: boolean;
    selectedUpdateCount: number;
    onToggleSelect: (modName: string) => void;
    onSelectVersion: (modName: string, ver: string) => void;
    onStartUpdateBatch: () => void;
}

export const InstalledUpdatesList: React.FC<InstalledUpdatesListProps> = ({
    mods,
    queue,
    isCheckingUpdates,
    isAnyLoading,
    selectedUpdateCount,
    onToggleSelect,
    onSelectVersion,
    onStartUpdateBatch,
}) => {
    const modsWithUpdates = mods.filter(m => m.hasUpdate);
    const anyUpdates = modsWithUpdates.length > 0;
    const totalMods = mods.length;
    const modsCheckedCount = mods.filter(m => m.thumbnail !== undefined || m.category !== undefined || m.hasUpdate || m.latestVersion !== undefined).length;

    const isModDownloading = (modName: string) => {
        return queue.some(q => (q.id.startsWith(modName) || q.name === modName) && q.progress < 100);
    };

    const updateCount = modsWithUpdates.length;

    return (
        <>
            {isCheckingUpdates && (
                <div className={`mb-3 px-3 py-2 rounded-xl flex items-center gap-2.5 ${LAYER.innerInset} ${BORDER.inner} text-[11px]`}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`font-semibold ${TEXT.secondary} shrink-0`}>Checking updates...</span>
                        {totalMods > 0 && (
                            <span className="font-mono text-indigo-500 font-bold shrink-0">
                                {Math.min(modsCheckedCount, totalMods)}/{totalMods} mods
                            </span>
                        )}
                        {anyUpdates && (
                            <>
                                <span className={`${TEXT.muted} shrink-0`}>•</span>
                                <span className="font-mono text-amber-500 font-bold shrink-0">
                                    {modsWithUpdates.length} update{modsWithUpdates.length === 1 ? '' : 's'} found
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {!isCheckingUpdates && !anyUpdates ? (
                <div className="text-center py-16 text-slate-400 dark:text-zinc-600 text-xs select-none">
                    All installed mods are up to date!
                </div>
            ) : anyUpdates ? (
                <>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(28rem,1fr))] gap-2.5">
                        {[...modsWithUpdates]
                            .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                            .map(mod => {
                                const activeDownloading = isModDownloading(mod.name);

                                return (
                                    <div
                                        key={mod.name}
                                        onClick={() => onToggleSelect(mod.name)}
                                        className={`h-full cursor-pointer ${LAYER.groupPanel} ${BORDER.card} rounded-2xl shadow-xs ${HOVER_BORDER.cardSoft} hover:shadow-md transition-all duration-200 overflow-hidden ${activeDownloading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <div className="h-full p-4 flex flex-col gap-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                                                    <Checkbox
                                                        checked={mod.selectedForUpdate || false}
                                                        onChange={() => onToggleSelect(mod.name)}
                                                        disabled={activeDownloading}
                                                        size="md"
                                                        accent="indigo"
                                                        className="mt-[13px]"
                                                        aria-label={`Select ${mod.title || mod.name} for update`}
                                                    />

                                                    {mod.thumbnail ? (
                                                        <img src={mod.thumbnail} alt={mod.title} className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0 mt-0.5" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0 mt-0.5 select-none shadow-xs">
                                                            {getInitials(mod.title || mod.name)}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <h3 className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-white">{mod.title || mod.name}</h3>
                                                            <span className="max-w-[150px] shrink truncate whitespace-nowrap text-xs font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-zinc-700/60" title={mod.name}>
                                                                {mod.name}
                                                            </span>
                                                        </div>
                                                        <div className={`mt-1 text-xs ${TEXT.secondary}`}>
                                                            <span>by </span>
                                                            <strong className="inline-block max-w-[180px] truncate align-bottom text-slate-700 dark:text-zinc-300 font-semibold" title={mod.author || 'Unknown'}>
                                                                {mod.author || 'Unknown'}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                <a
                                                    href={`https://mods.factorio.com/mod/${mod.name}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={event => event.stopPropagation()}
                                                    title={`Open ${mod.title || mod.name} on the Factorio Mod Portal`}
                                                    aria-label={`Open ${mod.title || mod.name} on the Factorio Mod Portal`}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </div>

                                            <div className="mt-auto flex items-center gap-1.5 flex-wrap pl-7">
                                                <span className="panel-pill panel-pill-mono bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 font-semibold select-none">
                                                    Installed: v{mod.version} (Update Available)
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                                                <InstalledVersionDropdown
                                                    versions={mod.newerVersions}
                                                    selectedVersion={mod.selectedTargetVersion || mod.latestVersion || mod.version}
                                                    onSelect={ver => onSelectVersion(mod.name, ver)}
                                                    disabled={activeDownloading}
                                                    label="Ver:"
                                                    valueClassName="font-extrabold text-emerald-600 dark:text-emerald-400"
                                                    compact
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                    {updateCount > 0 && (
                        <div className="sticky bottom-0 z-20 flex flex-col items-end gap-2.5 pt-2.5 pb-0 bg-transparent pointer-events-none">
                            <button
                                onClick={onStartUpdateBatch}
                                disabled={isAnyLoading || selectedUpdateCount === 0}
                                className="pointer-events-auto py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60"
                            >
                                {isAnyLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Resolving Batch...</span>
                                    </>
                                ) : isCheckingUpdates ? (
                                    <>
                                        <div className="loading-bars" style={{ height: '14px' }}>
                                            <i /><i /><i />
                                        </div>
                                        <span>Update Selected Mods ({selectedUpdateCount}) — Still Scanning...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Update Selected Mods ({selectedUpdateCount})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center gap-3 select-none">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span>Checking for updates, no updates found so far...</span>
                </div>
            )}
        </>
    );
};

export { getInitials as getInitialsUpdates };

export interface UpdatesHeaderActionsProps {
    updateCount: number;
    allUpdatesSelected: boolean;
    onSelectAll: (select: boolean) => void;
}

export const UpdatesHeaderActions: React.FC<UpdatesHeaderActionsProps> = ({ updateCount, allUpdatesSelected, onSelectAll }) => {
    if (updateCount === 0) return null;
    return (
        <button
            onClick={() => onSelectAll(!allUpdatesSelected)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer select-none pb-3"
        >
            {allUpdatesSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span>{allUpdatesSelected ? 'Deselect All' : 'Select All'}</span>
        </button>
    );
};
