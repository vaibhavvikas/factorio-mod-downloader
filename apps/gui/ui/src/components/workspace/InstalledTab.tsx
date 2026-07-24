import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, FolderSearch, RefreshCw, FolderOutput, AlertTriangle, Loader2, Trash2, ChevronDown, CheckSquare, Square, Package, Sparkles, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../context/AppContext';
import type { InstalledModItem } from '../../context/AppContext';
import { Checkbox } from '../ui/Checkbox';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT } from '../../theme/layers';

interface ConflictModalData {
    targetUpdates: { name: string; title: string; version: string }[];
    autoUpgradedDeps: { name: string; title: string; fromVersion: string; toVersion: string }[];
    fullBatch: { id: string; title: string; version: string; file_name: string; sha1: string }[];
}

interface DeleteModalData {
    targetMod: InstalledModItem;
    exclusiveDeps: InstalledModItem[];
    protectedDeps: { name: string; title: string; requiredBy: string[] }[];
}

const getInitials = (title: string): string => {
    if (!title) return 'MD';
    // Strip non-letter characters so special chars don't become initials
    const cleaned = title.replace(/[^a-zA-Z\s]/g, '').trim();
    if (!cleaned) return 'MD';
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase();
};

interface VersionDropdownProps {
    versions: string[];
    selectedVersion: string;
    onSelect: (ver: string) => void;
    disabled?: boolean;
    label?: string;
    valueClassName?: string;
}

const CustomVersionDropdown: React.FC<VersionDropdownProps> = ({
    versions,
    selectedVersion,
    onSelect,
    disabled,
    label = 'Ver:',
    valueClassName = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleOpen = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;

        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 280;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight
                ? rect.top - dropdownHeight - 6
                : rect.bottom + 6;
            setDropdownPos({ top, left: rect.left });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative select-none">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className="w-40 flex items-center bg-slate-100 dark:bg-zinc-950 px-1.5 py-0.5 rounded-lg border border-slate-200/80 dark:border-zinc-800 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
                <span className="text-[9px] text-slate-400 font-normal shrink-0">{label}</span>
                <span className="ml-auto flex min-w-0 items-center gap-1.5">
                    <span className={`truncate ${valueClassName}`}>v{selectedVersion}</span>
                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => setIsOpen(false)} />
                    <div
                        className="fixed z-[101] w-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-150"
                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    >
                        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs font-mono">
                            {versions.map(ver => {
                                const isSelected = ver === selectedVersion;
                                return (
                                    <div
                                        key={ver}
                                        onClick={() => {
                                            onSelect(ver);
                                            setIsOpen(false);
                                        }}
                                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                                            : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                            }`}
                                    >
                                        <span>v{ver}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export const InstalledTab: React.FC = () => {
    const {
        startDownload,
        addLog,
        queue,
        folderPath,
        setFolderPath,
        installedMods,
        setInstalledMods,
        loadingInstalled,
        isCheckingUpdates,
        refreshInstalledMods: loadInstalledMods
    } = useAppContext();
    const [loading, setLoading] = useState(false);
    const isAnyLoading = loading || loadingInstalled;
    const [activeTab, setActiveTab] = useState<'installed' | 'updates'>('installed');

    // Modals state
    const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);
    const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (deleteModalData) setDeleteModalData(null);
                if (conflictModalData) setConflictModalData(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteModalData, conflictModalData]);

    // Helper to check if a Factorio dependency string is a required dependency (not ?, ~, or !)
    const isDirectRequiredDependency = (rawDep: string): boolean => {
        const trimmed = rawDep.trim();
        if (trimmed.startsWith('?') || trimmed.startsWith('~') || trimmed.startsWith('!')) {
            return false;
        }
        if (/^\([^)]+\)\s*[?~!]/i.test(trimmed)) {
            return false;
        }
        return true;
    };

    // Calculate Reverse Dependencies (ONLY for direct REQUIRED dependencies)
    const computeReverseDependencies = (): Map<string, string[]> => {
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

    const dependentsMap = computeReverseDependencies();

    // Helper to check if a mod is an internal dependency category mod (e.g. category === 'internal' or asset pack)
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

    // Calculate Exclusive Dependency Chain for Mod Deletion (ONLY direct REQUIRED internal category dependencies)
    const calculateDeleteImpact = (targetMod: InstalledModItem): DeleteModalData => {
        const installedByName = new Map<string, InstalledModItem>();
        installedMods.forEach(m => installedByName.set(m.name, m));

        const candidateDeps = new Set<string>();
        const collectDeps = (mod: InstalledModItem) => {
            mod.dependencies.forEach(rawDep => {
                if (!isDirectRequiredDependency(rawDep)) return;

                const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();
                if (depName && depName !== 'base' && installedByName.has(depName) && !candidateDeps.has(depName)) {
                    const depMod = installedByName.get(depName)!;
                    // ONLY auto-remove if dependency is of 'internal' category or asset library!
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

    const handleOpenDeleteModal = (mod: InstalledModItem) => {
        const dependents = dependentsMap.get(mod.name) || [];
        if (dependents.length > 0) return;

        const impact = calculateDeleteImpact(mod);
        setDeleteModalData(impact);
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalData) return;

        const modsToDelete = [deleteModalData.targetMod, ...deleteModalData.exclusiveDeps];
        setDeleteModalData(null);

        setLoading(true);
        try {
            for (const mod of modsToDelete) {
                await invoke('delete_installed_mod', { filePath: mod.filePath });
                addLog(`Deleted mod "${mod.title || mod.name}" from mods folder.`, 'success');
            }
            await loadInstalledMods(folderPath);
        } catch (err: any) {
            addLog(`Failed to delete mods: ${err?.toString()}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBrowseFolder = async () => {
        try {
            const newPath = await invoke<string | null>('pick_mods_folder_dialog');
            if (newPath) {
                setFolderPath(newPath);
                await invoke('save_mods_folder', { path: newPath });
                await loadInstalledMods(newPath);
            }
        } catch (err) {
            console.error('Failed to pick folder:', err);
        }
    };

    const handleToggleSelect = (modName: string) => {
        setInstalledMods(prev =>
            prev.map(m => (m.name === modName ? { ...m, selectedForUpdate: !m.selectedForUpdate } : m))
        );
    };

    const handleSelectAll = (select: boolean) => {
        setInstalledMods(prev =>
            prev.map(m => (m.hasUpdate ? { ...m, selectedForUpdate: select } : m))
        );
    };

    const handleSelectVersion = (modName: string, ver: string) => {
        setInstalledMods(prev =>
            prev.map(m => (m.name === modName ? { ...m, selectedTargetVersion: ver } : m))
        );
    };

    const handleStartUpdateBatch = async () => {
        const selected = installedMods.filter(m => m.selectedForUpdate && m.hasUpdate);
        if (selected.length === 0) return;

        setLoading(true);
        addLog(`Analyzing dependency constraints for ${selected.length} mod update(s)...`, 'info');

        try {
            const mainMods = selected.map(s => ({
                id: s.name,
                title: s.title,
                version: s.selectedTargetVersion || s.latestVersion || s.version,
                file_name: `${s.name}_${s.selectedTargetVersion || s.latestVersion || s.version}.zip`,
                sha1: ''
            }));

            const resolvedBatch = await invoke<{ id: string; title: string; version: string; file_name: string; sha1: string }[]>('resolve_download_batch', {
                mainMods,
                directDeps: [],
                includeRecommended: false
            });

            const selectedNames = new Set(selected.map(s => s.name));
            const autoUpgraded: { name: string; title: string; fromVersion: string; toVersion: string }[] = [];

            resolvedBatch.forEach(res => {
                if (!selectedNames.has(res.id)) {
                    const existing = installedMods.find(i => i.name === res.id);
                    if (existing && existing.version !== res.version) {
                        autoUpgraded.push({
                            name: res.id,
                            title: existing.title || res.id,
                            fromVersion: existing.version,
                            toVersion: res.version
                        });
                    }
                }
            });

            if (autoUpgraded.length > 0) {
                setConflictModalData({
                    targetUpdates: selected.map(s => ({ name: s.name, title: s.title, version: s.selectedTargetVersion || s.version })),
                    autoUpgradedDeps: autoUpgraded,
                    fullBatch: resolvedBatch
                });
            } else {
                await executeDownloadBatch(resolvedBatch);
            }
        } catch (err: any) {
            addLog(`Dependency calculation failed for updates: ${err?.toString()}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const executeDownloadBatch = async (batch: { id: string; title: string; version: string; file_name: string; sha1: string }[]) => {
        try {
            await invoke('start_download_batch', {
                items: batch,
                outputDir: folderPath
            });

            startDownload(
                batch.map(item => ({
                    id: item.id,
                    name: item.title || item.id,
                    version: item.version,
                    size: 25.0
                })),
                'update'
            );
        } catch (err: any) {
            addLog(`Failed to execute mod updates: ${err?.toString()}`, 'error');
        }
    };

    const isModDownloading = (modName: string) => {
        return queue.some(q => (q.id.startsWith(modName) || q.name === modName) && q.progress < 100);
    };

    const updateCount = installedMods.filter(m => m.hasUpdate).length;
    const selectedUpdateCount = installedMods.filter(m => m.hasUpdate && m.selectedForUpdate).length;
    const allUpdatesSelected = updateCount > 0 && selectedUpdateCount === updateCount;

    return (
        <div className={`flex-1 flex flex-col overflow-hidden h-full ${LAYER.appCanvas} relative`}>
            {/* Exclusive Dependency Chain Deletion Confirmation Modal */}
            {deleteModalData && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 select-none animate-fade-in"
                    onClick={() => setDeleteModalData(null)}
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
                            {/* Target Mod */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1">Mod to Remove</span>
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
                                    <span className="truncate">{deleteModalData.targetMod.title || deleteModalData.targetMod.name}</span>
                                    <span className="panel-pill panel-pill-mono text-[10px] text-slate-500 dark:text-zinc-400 shrink-0 ml-2 bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/70 select-none">v{deleteModalData.targetMod.version}</span>
                                </div>
                            </div>

                            {/* Exclusive Sub-Dependencies To Remove */}
                            {deleteModalData.exclusiveDeps.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-1">Internal Dependencies to Remove</span>
                                    {deleteModalData.exclusiveDeps.map(dep => (
                                        <div key={dep.name} className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/20">
                                            <span className="truncate font-semibold">{dep.title || dep.name}</span>
                                            <span className="panel-pill panel-pill-mono text-[10px] text-amber-600 dark:text-amber-400 shrink-0 ml-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 select-none">v{dep.version}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Protected Shared Dependencies (Kept) */}
                            {deleteModalData.protectedDeps.length > 0 && (
                                <div className="flex flex-col gap-1.5 pt-0.5">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                            Protected Shared Dependencies (Kept)
                                        </span>
                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono font-medium">
                                            {deleteModalData.protectedDeps.length} protected
                                        </span>
                                    </div>

                                    {deleteModalData.protectedDeps.map(dep => {
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

                                                {/* Required By Section: Inline Pill List of Dependent Mods */}
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
                                onClick={() => setDeleteModalData(null)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer transition-all"
                            >
                                Confirm & Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dependency Upgrade Conflict Modal */}
            {conflictModalData && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 select-none animate-fade-in"
                    onClick={() => setConflictModalData(null)}
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
                            {conflictModalData.autoUpgradedDeps.map(dep => (
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
                                onClick={() => setConflictModalData(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const batch = conflictModalData.fullBatch;
                                    setConflictModalData(null);
                                    executeDownloadBatch(batch);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer transition-all"
                            >
                                Proceed & Update All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Toolbar Header */}
            <div className="pt-3 px-4 pb-0 shrink-0 flex flex-col gap-4">
                <div className={`h-10 pl-3.5 pr-1.5 py-1.5 ${LAYER.toolbar} ${BORDER.toolbar} rounded-xl flex items-center justify-between text-xs shadow-xs`}>
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300 overflow-hidden">
                        <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-400 dark:text-zinc-500">Mods Path:</span>
                        <span className="font-mono text-[11px] truncate text-slate-900 dark:text-zinc-100">{folderPath || 'Detecting folder...'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={(e) => {
                                e.currentTarget.blur();
                                handleBrowseFolder();
                            }}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700/60 cursor-pointer transition-colors"
                            title="Browse / Change Folder"
                        >
                            <FolderSearch className="w-3.5 h-3.5 text-indigo-500" />
                        </button>

                        <button
                            onClick={async (e) => {
                                e.currentTarget.blur();
                                if (!folderPath) return;
                                try {
                                    await invoke('open_folder_in_explorer', { path: folderPath });
                                } catch (err) {
                                    console.error('Failed to open folder:', err);
                                }
                            }}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700/60 cursor-pointer transition-colors"
                            title="Open folder in Finder / File Explorer"
                        >
                            <FolderOutput className="w-3.5 h-3.5 text-indigo-500" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.currentTarget.blur();
                                loadInstalledMods(folderPath);
                            }}
                            disabled={isAnyLoading}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700/60 cursor-pointer transition-colors disabled:opacity-50"
                            title="Refresh Installed Mods"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isAnyLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>


            </div>

            {/* Scrollable Mod List */}
            <div className="relative flex flex-col flex-1 min-h-0 px-4 pt-4 pb-2">
                <div className={`relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl ${BORDER.outer} ${LAYER.viewportGlass}`}>
                    {installedMods.length > 0 && (
                        <div className={`relative shrink-0 border-b ${DIVIDER.outer} ${LAYER.viewportHeader} px-4 pt-3 pb-0 flex items-start justify-between`}>
                            <div className="inline-flex gap-6 text-xs font-bold select-none -mb-px">
                                <button
                                    onClick={() => setActiveTab('installed')}
                                    className={`relative pb-3 flex items-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'installed'
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <Package className={`w-3.5 h-3.5 ${activeTab === 'installed' ? 'text-indigo-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                                    <span>Installed Mods</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${activeTab === 'installed' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-700/60 text-slate-600 dark:text-zinc-300'}`}>
                                        {installedMods.length}
                                    </span>
                                    {activeTab === 'installed' && (
                                        <span className="absolute bottom-0 -left-2 -right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('updates')}
                                    className={`relative pb-3 flex items-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === 'updates'
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'updates' ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                                    <span>Updates Available</span>
                                    {updateCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                            {updateCount}
                                        </span>
                                    )}
                                    {activeTab === 'updates' && (
                                        <span className="absolute bottom-0 -left-2 -right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                    )}
                                </button>
                            </div>
                            {activeTab === 'updates' && updateCount > 0 && (
                                <button
                                    onClick={() => handleSelectAll(!allUpdatesSelected)}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer select-none pb-3"
                                >
                                    {allUpdatesSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    <span>{allUpdatesSelected ? 'Deselect All' : 'Select All Outdated'}</span>
                                </button>
                            )}
                        </div>
                    )}
                    <div className="relative flex-1 min-h-0">
                        <div className="h-full overflow-y-auto p-4">
                            {installedMods.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-xs">
                                    {isAnyLoading ? 'Scanning installed mods & checking online updates...' : 'No installed mods found in selected folder.'}
                                </div>
                            ) : activeTab === 'installed' ? (
                                /* INSTALLED MODS TAB */
                                <div className="flex flex-col gap-2.5">
                                    {[...installedMods]
                                        .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                                        .map(mod => {
                                            const dependents = dependentsMap.get(mod.name) || [];
                                            const isDependentLocked = dependents.length > 0;

                                            return (
                                                <div key={mod.name} className={`p-4 ${LAYER.contentCard} ${BORDER.card} rounded-2xl flex items-center justify-between shadow-xs ${HOVER_BORDER.card} transition-all`}>
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        {/* Mod Thumbnail / Initials Avatar Box */}
                                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner overflow-hidden">
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

                                                    {/* Delete Button with Safety Lock Tooltip */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="relative group">
                                                            <button
                                                                onClick={() => handleOpenDeleteModal(mod)}
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
                            ) : (
                                /* UPDATES AVAILABLE TAB */
                                <>
                                    {isCheckingUpdates ? (
                                        <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                            <span>Checking for online updates...</span>
                                        </div>
                                    ) : installedMods.filter(m => m.hasUpdate).length === 0 ? (
                                        <div className="text-center py-16 text-slate-400 dark:text-zinc-600 text-xs select-none">
                                            All installed mods are up to date!
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-[repeat(auto-fit,minmax(28rem,1fr))] gap-2.5">
                                                {[...installedMods]
                                                    .filter(m => m.hasUpdate)
                                                    .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                                                    .map(mod => {
                                                        const activeDownloading = isModDownloading(mod.name);

                                                        return (
                                                            <div
                                                                key={mod.name}
                                                                onClick={() => handleToggleSelect(mod.name)}
                                                                className={`h-full cursor-pointer ${LAYER.groupPanel} ${BORDER.card} rounded-2xl shadow-xs ${HOVER_BORDER.cardSoft} hover:shadow-md transition-all duration-200 overflow-hidden ${activeDownloading ? 'opacity-60 pointer-events-none' : ''}`}>
                                                                <div className="h-full p-4 flex flex-col gap-3">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                                                                            <Checkbox
                                                                                checked={mod.selectedForUpdate || false}
                                                                                onChange={() => handleToggleSelect(mod.name)}
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

                                                                    <div className="mt-auto flex items-center gap-2 flex-wrap pl-7">
                                                                        <span className="w-fit whitespace-nowrap px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 text-xs font-mono font-normal text-slate-400 dark:text-zinc-400 select-none">
                                                                            Installed v{mod.version}
                                                                        </span>
                                                                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                                                        <CustomVersionDropdown
                                                                            versions={mod.newerVersions}
                                                                            selectedVersion={mod.selectedTargetVersion || mod.latestVersion || mod.version}
                                                                            onSelect={ver => handleSelectVersion(mod.name, ver)}
                                                                            disabled={activeDownloading}
                                                                            label="Update:"
                                                                            valueClassName="font-extrabold text-emerald-600 dark:text-emerald-400"
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
                                                        onClick={handleStartUpdateBatch}
                                                        disabled={isAnyLoading || selectedUpdateCount === 0}
                                                        className="pointer-events-auto py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60"
                                                    >
                                                        {isAnyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                        <span>{isAnyLoading ? 'Resolving Batch...' : `Update Selected Mods (${selectedUpdateCount})`}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
