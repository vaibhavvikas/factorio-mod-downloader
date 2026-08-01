import React from 'react';
import { Loader2, ExternalLink, ArrowRight, ArrowUp, ArrowDown, CheckSquare, Square, Wrench } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { InstalledModItem, DownloadTask } from '../../../context/AppContext';
import { Checkbox } from '../../ui/Checkbox';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT, PILL_SIZE } from '../../../theme/layers';
import { InstalledVersionDropdown } from './InstalledVersionDropdown';
import { Tooltip } from '../../ui/Tooltip';

function compareVersions(a: string, b: string): number {
    const parse = (v: string) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    const maxLen = Math.max(pa.length, pb.length);
    for (let i = 0; i < maxLen; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

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
    const modsWithUpdates = mods.filter(m => m.hasUpdate || (m.selectedTargetVersion ? m.selectedTargetVersion !== m.version : false));
    const anyUpdates = modsWithUpdates.length > 0;
    const totalMods = mods.length;
    const modsCheckedCount = mods.filter(m => m.thumbnail !== undefined || m.category !== undefined || m.hasUpdate || m.latestVersion !== undefined).length;

    const isModDownloading = (modName: string) => {
        return queue.some(q => (q.id.startsWith(modName) || q.name === modName) && q.progress < 100);
    };

    const updateCount = modsWithUpdates.length;

    const upgradeMods = [...modsWithUpdates]
        .filter(m => {
            const targetVer = m.selectedTargetVersion || m.latestVersion || m.version;
            return compareVersions(targetVer, m.version) >= 0;
        })
        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    const downgradeMods = [...modsWithUpdates]
        .filter(m => {
            const targetVer = m.selectedTargetVersion || m.latestVersion || m.version;
            return compareVersions(targetVer, m.version) < 0;
        })
        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    const renderCard = (mod: InstalledModItem) => {
        const activeDownloading = isModDownloading(mod.name);
        return (
            <div
                key={mod.name}
                onClick={(event) => {
                    if ((event as any).__ignoreCardToggle) return;
                    onToggleSelect(mod.name);
                }}
                onClickCapture={(event) => {
                    const target = event.target as Element | null;
                    if (!target || !(target instanceof Element)) return;
                    const interactive = target.closest(
                        'button, a, input, select, textarea, label, option, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="listbox"], [role="combobox"], [role="dialog"], [role="menu"]'
                    );
                    if (interactive) (event as any).__ignoreCardToggle = true;
                }}
                className={`h-full cursor-pointer ${LAYER.contentCard} ${BORDER.card} rounded-2xl shadow-xs ${HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200 overflow-hidden ${activeDownloading ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="h-full p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                            <Checkbox
                                checked={mod.selectedForUpdate || false}
                                onChange={() => onToggleSelect(mod.name)}
                                disabled={activeDownloading}
                                size="md"
                                accent="blue"
                                className="mt-[13px]"
                                aria-label={`Select ${mod.title || mod.name} for update`}
                            />

                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-500/15 dark:bg-blue-500/25 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 mt-0.5 select-none shadow-xs">
                                {mod.thumbnail ? (
                                    <img src={mod.thumbnail} alt={mod.title} className="w-full h-full object-cover" />
                                ) : (
                                    getInitials(mod.title || mod.name)
                                )}
                            </div>

                            <div className="flex flex-col min-w-0">
                                <h3 className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-white">{mod.title || mod.name}</h3>
                                <div className={`mt-1 text-xs ${TEXT.secondary}`}>
                                    <span>by </span>
                                    <strong className="inline-block max-w-[180px] truncate align-bottom text-slate-700 dark:text-zinc-300 font-semibold">
                                        {mod.author || 'Unknown'}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <Tooltip content="Open on Mod Portal">
                            <a
                                href={`https://mods.factorio.com/mod/${mod.name}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={async (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    await openUrl(`https://mods.factorio.com/mod/${mod.name}`);
                                }}
                                aria-label={`Open ${mod.title || mod.name} on the Factorio Mod Portal`}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer block"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </Tooltip>
                    </div>

                    <div className="mt-auto flex items-center gap-1.5 flex-wrap pl-7">
                        <span className={`panel-pill ${PILL_SIZE.comfortableMono} gap-1.5 shrink-0 select-none cursor-default ${LAYER.staticPill} ${BORDER.card} text-slate-500 dark:text-zinc-400`}>
                            <span className="font-bold text-slate-500 dark:text-zinc-400/90 text-[11px]">Installed</span>
                            <span className="font-mono font-semibold text-slate-600 dark:text-zinc-300">v{mod.version}</span>
                        </span>
                        {(() => {
                            const currentSelectedVer = mod.selectedTargetVersion || mod.latestVersion || mod.version;
                            const cmp = compareVersions(currentSelectedVer, mod.version);
                            if (cmp > 0) {
                                return <ArrowUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 font-bold" aria-label="Upgrade" />;
                            } else if (cmp < 0) {
                                return <ArrowDown className="w-3.5 h-3.5 text-amber-500 shrink-0 font-bold" aria-label="Downgrade" />;
                            } else {
                                return <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />;
                            }
                        })()}
                        <InstalledVersionDropdown
                            versions={mod.newerVersions}
                            selectedVersion={mod.selectedTargetVersion || mod.latestVersion || mod.version}
                            onSelect={ver => onSelectVersion(mod.name, ver)}
                            disabled={activeDownloading}
                            label="Ver:"
                            valueClassName="font-extrabold text-blue-600 dark:text-blue-400"
                            compact
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {!anyUpdates ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 select-none text-center">
                    {isCheckingUpdates ? (
                        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-zinc-500 text-xs">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            <span>Checking Mod Portal for updates...</span>
                            {totalMods > 0 && (
                                <span className="font-mono text-[11px] text-blue-500 font-bold">
                                    {Math.min(modsCheckedCount, totalMods)} / {totalMods} mods checked
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-slate-400 dark:text-zinc-600 text-xs">
                            All installed mods are up to date!
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                        {upgradeMods.length > 0 && (
                            <>
                                <div className="col-span-full pt-1 pb-1.5 flex items-center gap-2.5 select-none">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider shrink-0">
                                        <ArrowUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span>Mod Upgrades ({upgradeMods.length})</span>
                                    </div>
                                    <div className={`h-px ${DIVIDER.line} flex-1`} />
                                </div>
                                {upgradeMods.map(renderCard)}
                            </>
                        )}

                        {downgradeMods.length > 0 && (
                            <>
                                <div className={`col-span-full ${upgradeMods.length > 0 ? 'pt-4' : 'pt-1'} pb-1.5 flex items-center gap-2.5 select-none`}>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                                        <ArrowDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span>Mod Downgrades ({downgradeMods.length})</span>
                                    </div>
                                    <div className={`h-px ${DIVIDER.line} flex-1`} />
                                </div>
                                {downgradeMods.map(renderCard)}
                            </>
                        )}
                    </div>
                    {updateCount > 0 && (
                        <div className="sticky bottom-0 z-20 flex flex-col items-end gap-2.5 pt-2.5 pb-0 bg-transparent pointer-events-none">
                            <button
                                onClick={onStartUpdateBatch}
                                disabled={isAnyLoading || selectedUpdateCount === 0}
                                className="pointer-events-auto py-2.5 px-5 bg-[#1a7f37] hover:bg-[#238636] active:bg-[#196c2e] text-white font-bold text-xs rounded-xl shadow-sm border border-[#1a7f37]/50 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60"
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
                                        <span>Apply Selected Fixes ({selectedUpdateCount}) — Scanning...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wrench className="w-3.5 h-3.5" />
                                        <span>Apply Selected Fixes ({selectedUpdateCount})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export interface UpdatesHeaderActionsProps {
    updateCount: number;
    allUpdatesSelected: boolean;
    onSelectAll: (select: boolean) => void;
    isCheckingUpdates?: boolean;
    modsCheckedCount?: number;
    totalMods?: number;
}

export const UpdatesHeaderActions: React.FC<UpdatesHeaderActionsProps> = ({
    updateCount,
    allUpdatesSelected,
    onSelectAll,
    isCheckingUpdates,
    modsCheckedCount = 0,
    totalMods = 0,
}) => {
    return (
        <div className="flex items-center gap-3 select-none">
            {isCheckingUpdates && totalMods > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{Math.min(modsCheckedCount, totalMods)}/{totalMods}</span>
                </div>
            )}
            {updateCount > 0 && (
                <button
                    onClick={() => onSelectAll(!allUpdatesSelected)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5 cursor-pointer select-none"
                >
                    {allUpdatesSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <span>{allUpdatesSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
            )}
        </div>
    );
};
