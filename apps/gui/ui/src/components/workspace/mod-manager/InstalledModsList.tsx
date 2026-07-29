import React from 'react';
import { Trash2 } from 'lucide-react';
import type { InstalledModItem } from '../../../context/AppContext';
import { LAYER, BORDER, HOVER_BORDER, TEXT } from '../../../theme/layers';

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
}

export const InstalledModsList: React.FC<InstalledModsListProps> = ({ mods, dependentsMap, onOpenDeleteModal }) => {
    return (
        <div className="flex flex-col gap-2.5">
            {[...mods]
                .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                .map(mod => {
                    const dependents = dependentsMap.get(mod.name) || [];
                    const isDependentLocked = dependents.length > 0;

                    return (
                        <div key={mod.name} className={`p-4 ${LAYER.contentCard} ${BORDER.card} rounded-2xl flex items-center justify-between shadow-xs ${HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200`}>
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 shrink-0 shadow-inner overflow-hidden">
                                    {mod.thumbnail ? (
                                        <img src={mod.thumbnail} alt={mod.title} className="w-full h-full object-cover rounded-xl" />
                                    ) : (
                                        <span>{getInitials(mod.title || mod.name)}</span>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 truncate">{mod.title || mod.name}</span>
                                        <span className="panel-pill panel-pill-mono bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full px-2.5 py-0.5">v{mod.version}</span>
                                    </div>

                                    <div className={`flex items-center gap-3 text-[11px] ${TEXT.secondary} font-mono`}>
                                        <span>Author: {mod.author || 'Unknown'}</span>
                                        <span>•</span>
                                        <span className="truncate">{mod.fileName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <div className="relative group">
                                    <button
                                        onClick={() => onOpenDeleteModal(mod)}
                                        disabled={isDependentLocked}
                                        className={`p-2 rounded-xl border transition-colors ${isDependentLocked ? 'bg-slate-100 dark:bg-zinc-800/40 text-slate-300 dark:text-zinc-600 border-slate-200 dark:border-zinc-800 cursor-not-allowed' : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 cursor-pointer'}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {isDependentLocked && (
                                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-30 w-48 p-2 bg-slate-900 text-white dark:bg-zinc-800 text-[10px] rounded-lg shadow-xl font-medium pointer-events-none select-none">
                                            Cannot delete: Required by {dependents.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};
