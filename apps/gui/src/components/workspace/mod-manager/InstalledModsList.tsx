import React from 'react';
import { Trash2, ExternalLink, AlertTriangle, ArrowDown, Wrench, CheckCircle, ArrowUp } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { InstalledModItem } from '../../../context/AppContext';
import { useAppContext } from '../../../context/AppContext';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT, PILL_SIZE, PILL_TONE } from '../../../theme/layers';
import { Tooltip } from '../../ui/Tooltip';

export function compareVersions(a: string, b: string): number {
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

interface InstalledModsListProps {
    mods: InstalledModItem[];
    dependentsMap: Map<string, string[]>;
    onOpenDeleteModal: (mod: InstalledModItem) => void;
    onUpdateMod?: (mod: InstalledModItem, version: string) => void;
}

export const InstalledModsList: React.FC<InstalledModsListProps> = ({ mods, dependentsMap, onOpenDeleteModal, onUpdateMod }) => {
    const { factorioVersion } = useAppContext();

    const isModIncompatible = (mod: InstalledModItem) => {
        if (!factorioVersion || factorioVersion === 'all' || factorioVersion === 'any') return false;
        if (!mod.factorioVersion) return false;
        const cleanTarget = factorioVersion.trim().toLowerCase();
        const cleanModFver = mod.factorioVersion.trim().toLowerCase();
        const isComp = cleanModFver === cleanTarget || cleanModFver.startsWith(cleanTarget) || cleanTarget.startsWith(cleanModFver);
        return !isComp && !mod.hasUpdate;
    };

    const actionRequiredMods = [...mods]
        .filter(m => m.hasUpdate)
        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    const healthyMods = [...mods]
        .filter(m => !m.hasUpdate && !isModIncompatible(m))
        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    const incompatibleMods = [...mods]
        .filter(m => isModIncompatible(m))
        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    const renderCard = (mod: InstalledModItem) => {
        const dependents = dependentsMap.get(mod.name) || [];
        const isDependentLocked = dependents.length > 0;

        return (
            <div
                key={mod.name}
                className={`h-full ${LAYER.contentCard} ${BORDER.card} rounded-2xl shadow-xs ${HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200 overflow-hidden`}
            >
                <div className="h-full p-4 flex flex-col justify-between gap-3">
                    {/* Top Section: Thumbnail + Mod Title & Name + Author */}
                    <div className="flex items-start gap-3 min-w-0">
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
                                <span>by <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{mod.author || 'Unknown'}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-1 min-w-0">
                        {(() => {
                            const isIncompatible = isModIncompatible(mod);
                            const targetVer = mod.selectedTargetVersion || mod.latestVersion || mod.newerVersions[0];

                            return (
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                    <span className={`panel-pill ${PILL_SIZE.comfortableMono} shrink-0 select-none cursor-default ${LAYER.staticPill} ${BORDER.card} text-slate-500 dark:text-zinc-400`}>
                                        <span className="font-mono font-semibold text-slate-600 dark:text-zinc-300">v{mod.version}</span>
                                    </span>

                                    {mod.hasUpdate && targetVer ? (() => {
                                        const cmp = compareVersions(targetVer, mod.version);
                                        const isDowngrade = cmp < 0;

                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (onUpdateMod) {
                                                        onUpdateMod(mod, targetVer);
                                                    }
                                                }}
                                                className={`panel-pill ${PILL_SIZE.comfortableMono} transition-colors cursor-pointer gap-1 select-none shrink-0 ${isDowngrade
                                                    ? 'text-amber-600 dark:text-amber-400 border border-amber-500/30 dark:border-amber-400/30 hover:bg-amber-500/10 dark:hover:bg-amber-400/10'
                                                    : 'text-blue-600 dark:text-blue-400 border border-blue-500/30 dark:border-blue-400/30 hover:bg-blue-500/10 dark:hover:bg-blue-400/10'
                                                    }`}
                                            >
                                                {isDowngrade ? (
                                                    <ArrowDown className="w-3 h-3 text-amber-500 shrink-0" />
                                                ) : (
                                                    <ArrowUp className="w-3 h-3 text-blue-500 shrink-0" />
                                                )}
                                                <span>{isDowngrade ? 'Downgrade to' : 'Update to'} v{targetVer}</span>
                                            </button>
                                        );
                                    })() : isIncompatible ? (
                                        <span
                                            className={`panel-pill ${PILL_SIZE.comfortableMono} shrink-0 font-mono font-semibold select-none cursor-default ${PILL_TONE.incompatibleOutline}`}
                                        >
                                            Requires Factorio {mod.factorioVersion || '< 2.0'}
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })()}

                        {/* Action Buttons: Mod Portal Link + Trash Icon (Explore Card Style) */}
                        <div className="flex shrink-0 items-center gap-1">
                            <Tooltip content="Open on Mod Portal">
                                <a
                                    href={`https://mods.factorio.com/mod/${mod.name}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        await openUrl(`https://mods.factorio.com/mod/${mod.name}`);
                                    }}
                                    aria-label={`Open ${mod.title || mod.name} on the Factorio Mod Portal`}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-blue-400 cursor-pointer block"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </Tooltip>

                            <Tooltip content={isDependentLocked ? `Cannot delete: Required by ${dependents.join(', ')}` : `Delete ${mod.title || mod.name}`}>
                                <button
                                    onClick={() => onOpenDeleteModal(mod)}
                                    disabled={isDependentLocked}
                                    className={`rounded-lg p-1.5 border transition-all cursor-pointer ${isDependentLocked
                                        ? 'bg-slate-100/50 dark:bg-zinc-800/40 text-slate-300 dark:text-zinc-700 border-slate-200/60 dark:border-zinc-800/60 cursor-not-allowed opacity-40'
                                        : 'bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 border-slate-200 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-800/60'
                                        }`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {actionRequiredMods.length > 0 && (
                <>
                    <div className="col-span-full pt-1 pb-1.5 flex items-center gap-2.5 select-none">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                            <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Action Required ({actionRequiredMods.length})</span>
                        </div>
                        <div className={`h-px ${DIVIDER.line} flex-1`} />
                    </div>
                    {actionRequiredMods.map(renderCard)}
                </>
            )}

            {actionRequiredMods.length > 0 && healthyMods.length > 0 && (
                <div className="col-span-full pt-3 pb-1.5 flex items-center gap-2.5 select-none">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Up to Date ({healthyMods.length})</span>
                    </div>
                    <div className={`h-px ${DIVIDER.line} flex-1`} />
                </div>
            )}

            {healthyMods.map(renderCard)}

            {incompatibleMods.length > 0 && (
                <>
                    <div className="col-span-full pt-4 pb-1.5 flex items-center gap-2.5 select-none">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Incompatible Mods ({incompatibleMods.length})</span>
                        </div>
                        <div className={`h-px ${DIVIDER.line} flex-1`} />
                    </div>
                    {incompatibleMods.map(renderCard)}
                </>
            )}
        </div>
    );
};
