import React from 'react';
import { Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { InstalledModItem } from '../../../context/AppContext';

export interface ConflictModalData {
    targetUpdates: { name: string; title: string; version: string }[];
    autoUpgradedDeps: { name: string; title: string; fromVersion: string; toVersion: string }[];
    fullBatch: { id: string; title: string; version: string; file_name: string; sha1: string }[];
}

export interface DeleteModalData {
    targetMod: InstalledModItem;
    exclusiveDeps: InstalledModItem[];
    protectedDeps: { name: string; title: string; requiredBy: string[] }[];
}

export const isDirectRequiredDependency = (rawDep: string): boolean => {
    const trimmed = rawDep.trim();
    if (trimmed.startsWith('?') || trimmed.startsWith('~') || trimmed.startsWith('!')) {
        return false;
    }
    if (/^\([^)]+\)\s*[?~!]/i.test(trimmed)) {
        return false;
    }
    return true;
};

export const computeReverseDependencies = (
    installedMods: InstalledModItem[]
): Map<string, string[]> => {
    const dependentsMap = new Map<string, string[]>();

    installedMods.forEach(parentMod => {
        parentMod.dependencies.forEach(rawDep => {
            if (!isDirectRequiredDependency(rawDep)) return;

            const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();

            if (depName && depName !== 'base') {
                if (!dependentsMap.has(depName)) {
                    dependentsMap.set(depName, []);
                }
                const list = dependentsMap.get(depName)!;
                if (!list.includes(parentMod.title || parentMod.name)) {
                    list.push(parentMod.title || parentMod.name);
                }
            }
        });
    });

    return dependentsMap;
};

const isInternalCategoryMod = (mod: InstalledModItem): boolean => {
    if (mod.category && mod.category.toLowerCase() === 'internal') {
        return true;
    }
    const nameLower = mod.name.toLowerCase();
    if (nameLower.endsWith('-assets') || nameLower.endsWith('_assets') || nameLower.includes('asset')) {
        return true;
    }
    return false;
};

export const calculateDeleteImpact = (
    targetMod: InstalledModItem,
    installedMods: InstalledModItem[]
): DeleteModalData => {
    const installedByName = new Map<string, InstalledModItem>();
    installedMods.forEach(m => installedByName.set(m.name, m));

    const candidateDeps = new Set<string>();
    const collectDeps = (mod: InstalledModItem) => {
        mod.dependencies.forEach(rawDep => {
            if (!isDirectRequiredDependency(rawDep)) return;

            const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();
            if (depName && depName !== 'base' && installedByName.has(depName) && !candidateDeps.has(depName)) {
                const depMod = installedByName.get(depName)!;
                if (isInternalCategoryMod(depMod)) {
                    candidateDeps.add(depName);
                    collectDeps(depMod);
                }
            }
        });
    };
    collectDeps(targetMod);

    const exclusiveDeps: InstalledModItem[] = [];
    const protectedDeps: { name: string; title: string; requiredBy: string[] }[] = [];

    candidateDeps.forEach(depName => {
        const depMod = installedByName.get(depName);
        if (!depMod) return;

        const requiredByExternal: string[] = [];
        installedMods.forEach(otherMod => {
            if (otherMod.name === targetMod.name || candidateDeps.has(otherMod.name)) return;

            otherMod.dependencies.forEach(rawDep => {
                if (!isDirectRequiredDependency(rawDep)) return;

                const reqName = rawDep.trim().split(/[\s>=<]/)[0].trim();
                if (reqName === depName) {
                    requiredByExternal.push(otherMod.title || otherMod.name);
                }
            });
        });

        if (requiredByExternal.length > 0) {
            protectedDeps.push({
                name: depName,
                title: depMod.title || depName,
                requiredBy: requiredByExternal
            });
        } else {
            exclusiveDeps.push(depMod);
        }
    });

    return {
        targetMod,
        exclusiveDeps,
        protectedDeps
    };
};

interface DeleteModModalProps {
    data: DeleteModalData;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteModModal: React.FC<DeleteModModalProps> = ({ data, onClose, onConfirm }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 select-none animate-fade-in"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-[92vw] min-w-[360px] max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[85vh] shadow-2xl p-5 md:p-6 flex flex-col gap-3.5 transition-all select-text"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 text-rose-500">
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Delete Mod & Exclusive Internal Dependencies</h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">Removing this mod will clean up unneeded internal sub-dependencies.</p>
                    </div>
                </div>

                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 bg-slate-50 dark:bg-zinc-950/60 max-h-[48vh] md:max-h-[58vh] overflow-y-auto flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1">Mod to Remove</span>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                            <span className="truncate">{data.targetMod.title || data.targetMod.name}</span>
                            <span className="panel-pill panel-pill-mono text-[10px] text-slate-500 dark:text-zinc-400 shrink-0 ml-2 bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/70 select-none">v{data.targetMod.version}</span>
                        </div>
                    </div>

                    {data.exclusiveDeps.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-1">Internal Dependencies to Remove</span>
                            {data.exclusiveDeps.map(dep => (
                                <div key={dep.name} className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/20">
                                    <span className="truncate font-semibold">{dep.title || dep.name}</span>
                                    <span className="panel-pill panel-pill-mono text-[10px] text-amber-600 dark:text-amber-400 shrink-0 ml-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 select-none">v{dep.version}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {data.protectedDeps.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-0.5">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    Protected Shared Dependencies (Kept)
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono font-medium">
                                    {data.protectedDeps.length} protected
                                </span>
                            </div>

                            {data.protectedDeps.map(dep => {
                                const displayName = dep.title && dep.title.trim() ? dep.title : dep.name;
                                const reqList = dep.requiredBy;
                                const count = reqList.length;

                                return (
                                    <div
                                        key={dep.name}
                                        className="flex flex-col gap-1.5 p-2.5 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 overflow-visible"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                                                    {displayName}
                                                </span>
                                                <span className="bg-slate-100/80 dark:bg-zinc-800/80 px-1 py-0.5 rounded text-[9.5px] font-mono text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60 select-none truncate">
                                                    {dep.name}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 px-0.5 pt-0.5">
                                            <span className="text-[10px] font-medium text-emerald-600/90 dark:text-emerald-400/90 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                Required by {count} installed mod{count > 1 ? 's' : ''}:
                                            </span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {reqList.map((reqMod, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="panel-pill panel-pill-mono text-[9.5px] bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700/80 shadow-2xs select-none max-w-[240px]"
                                                    >
                                                        <span className="truncate min-w-0">{reqMod}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer transition-all"
                    >
                        Confirm & Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

interface DependencyUpgradeConflictModalProps {
    data: ConflictModalData;
    onClose: () => void;
    onProceed: (batch: ConflictModalData['fullBatch']) => void;
}

export const DependencyUpgradeConflictModal: React.FC<DependencyUpgradeConflictModalProps> = ({ data, onClose, onProceed }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 select-none animate-fade-in"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-[92vw] min-w-[360px] max-w-lg md:max-w-xl max-h-[85vh] shadow-2xl p-6 flex flex-col gap-4 transition-all select-text"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 text-amber-500">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Dependency Upgrade Required</h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">Updating selected mods requires upgrading additional installed dependencies.</p>
                    </div>
                </div>

                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 bg-slate-50 dark:bg-zinc-950/60 max-h-[40vh] md:max-h-[50vh] overflow-y-auto flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Mod Upgrades</span>
                    {data.autoUpgradedDeps.map(dep => (
                        <div key={dep.name} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{dep.title}</span>
                            <span className="font-mono text-[10px] text-indigo-500 font-bold">
                                v{dep.fromVersion} ➔ v{dep.toVersion}
                            </span>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-300">
                    Proceeding will update both your selected mods and these required dependencies.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onProceed(data.fullBatch)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer transition-all"
                    >
                        Proceed & Update All
                    </button>
                </div>
            </div>
        </div>
    );
};
