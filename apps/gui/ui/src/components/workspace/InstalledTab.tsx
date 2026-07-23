import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, FolderSearch, RefreshCw, FolderOutput, AlertTriangle, Loader2, Trash2, ChevronDown, CheckSquare, Square, Package, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../context/AppContext';

export interface InstalledModItem {
    name: string;
    title: string;
    version: string;
    author?: string;
    factorio_version?: string;
    category?: string;
    fileName: string;
    filePath: string;
    thumbnail?: string;
    dependencies: string[];
    hasUpdate: boolean;
    latestVersion?: string;
    newerVersions: string[];
    selectedTargetVersion?: string;
    selectedForUpdate?: boolean;
}

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
    const words = title.trim().split(/[\s-_]+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.slice(0, 2).toUpperCase();
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
                className="w-40 flex items-center bg-slate-100 dark:bg-zinc-950 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
                <span className="text-xs text-slate-400 font-normal shrink-0">{label}</span>
                <span className="ml-auto flex min-w-0 items-center gap-1.5">
                    <span className={`truncate ${valueClassName}`}>v{selectedVersion}</span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
    const { startDownload, addLog, queue } = useAppContext();
    const [folderPath, setFolderPath] = useState('');
    const [installedMods, setInstalledMods] = useState<InstalledModItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
    const [activeTab, setActiveTab] = useState<'installed' | 'updates'>('installed');

    // Modals state
    const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);
    const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);

    const hasScannedRef = useRef(false);

    // Initial Load & Folder Detection
    useEffect(() => {
        const initFolder = async () => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;

            try {
                let path = await invoke<string | null>('get_mods_folder');
                if (!path) {
                    path = await invoke<string>('detect_default_mods_folder');
                }
                setFolderPath(path || '');
                if (path) {
                    await loadInstalledMods(path);
                }
            } catch (err) {
                console.error('Failed to detect mods folder:', err);
            }
        };
        initFolder();
    }, []);

    const loadInstalledMods = async (path: string) => {
        setLoading(true);
        setIsCheckingUpdates(true);

        try {
            addLog('Fetching installed mods list...', 'info');
            const rawList = await invoke<InstalledModItem[]>('get_installed_mods_info', { modsFolder: path });
            const listWithSelection = rawList.map(item => ({
                ...item,
                selectedForUpdate: item.hasUpdate,
                selectedTargetVersion: item.newerVersions[0] || item.version
            }));
            setInstalledMods(listWithSelection);

            addLog(`Loaded ${rawList.length} installed mod(s). Fetching online update info...`, 'info');
            const checkedList = await invoke<InstalledModItem[]>('check_mod_updates', { installedMods: rawList });
            const checkedWithSelection = checkedList.map(item => ({
                ...item,
                selectedForUpdate: item.hasUpdate,
                selectedTargetVersion: item.newerVersions[0] || item.version
            }));
            setInstalledMods(checkedWithSelection);
            const updatesAvailable = checkedList.filter(item => item.hasUpdate).length;
            addLog(`Mod check complete: ${updatesAvailable} update(s) available.`, 'success');
        } catch (err: any) {
            addLog(`Failed to scan installed mods: ${err?.toString()}`, 'error');
        } finally {
            setLoading(false);
            setIsCheckingUpdates(false);
        }
    };

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
            hasScannedRef.current = false;
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
                hasScannedRef.current = false;
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
        <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-100 dark:bg-zinc-950 relative">
            {/* Exclusive Dependency Chain Deletion Confirmation Modal */}
            {deleteModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-3 text-rose-500">
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Delete Mod & Exclusive Internal Dependencies</h3>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Removing this mod will clean up unneeded internal sub-dependencies.</p>
                            </div>
                        </div>

                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 bg-slate-50 dark:bg-zinc-950/60 max-h-52 overflow-y-auto flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1">Mod to Remove</span>
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                                    <span className="truncate">{deleteModalData.targetMod.title || deleteModalData.targetMod.name}</span>
                                    <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-2">v{deleteModalData.targetMod.version}</span>
                                </div>
                            </div>

                            {deleteModalData.exclusiveDeps.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-1">Internal Dependencies to Remove</span>
                                    {deleteModalData.exclusiveDeps.map(dep => (
                                        <div key={dep.name} className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/20">
                                            <span className="truncate font-semibold">{dep.title || dep.name}</span>
                                            <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 shrink-0 ml-2">v{dep.version}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {deleteModalData.protectedDeps.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider px-1">Protected Shared Dependencies (Kept)</span>
                                    {deleteModalData.protectedDeps.map(dep => (
                                        <div key={dep.name} className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                            <span className="truncate">{dep.title}</span>
                                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">Required by {dep.requiredBy.join(', ')}</span>
                                        </div>
                                    ))}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3 text-amber-500">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Dependency Upgrade Required</h3>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Updating selected mods requires upgrading additional installed dependencies.</p>
                            </div>
                        </div>

                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 bg-slate-50 dark:bg-zinc-950/60 max-h-48 overflow-y-auto flex flex-col gap-2">
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
            <div className="pt-3 px-6 pb-2 shrink-0 flex flex-col gap-3">
                <div className="h-10 px-3.5 py-1.5 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs shadow-xs">
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300 overflow-hidden">
                        <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-400 dark:text-zinc-500">Mods Path:</span>
                        <span className="font-mono text-[11px] truncate text-slate-900 dark:text-zinc-100">{folderPath || 'Detecting folder...'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={handleBrowseFolder}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800/80 cursor-pointer transition-colors"
                            title="Browse / Change Folder"
                        >
                            <FolderSearch className="w-3.5 h-3.5 text-indigo-500" />
                        </button>

                        <button
                            onClick={async () => {
                                if (!folderPath) return;
                                try {
                                    await invoke('open_folder_in_explorer', { path: folderPath });
                                } catch (err) {
                                    console.error('Failed to open folder:', err);
                                }
                            }}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800/80 cursor-pointer transition-colors"
                            title="Open folder in Finder / File Explorer"
                        >
                            <FolderOutput className="w-3.5 h-3.5 text-indigo-500" />
                        </button>

                        <button
                            onClick={() => {
                                hasScannedRef.current = false;
                                loadInstalledMods(folderPath);
                            }}
                            disabled={loading}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800/80 cursor-pointer transition-colors disabled:opacity-50"
                            title="Refresh Installed Mods"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Mod Manager Navigation & Controls */}
                <div className="flex justify-between items-center">
                    <div className="flex gap-1 bg-slate-200/50 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800/60 text-xs select-none">
                        <button
                            onClick={() => setActiveTab('installed')}
                            className={`px-3.5 py-1.5 rounded-lg font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeTab === 'installed' ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <Package className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Installed Mods ({installedMods.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('updates')}
                            className={`px-3.5 py-1.5 rounded-lg font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5 ${activeTab === 'updates' ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Updates Available ({updateCount})</span>
                        </button>
                    </div>

                    {activeTab === 'updates' && updateCount > 0 && (
                        <button
                            onClick={() => handleSelectAll(!allUpdatesSelected)}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                            {allUpdatesSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            <span>{allUpdatesSelected ? 'Deselect All' : 'Select All Outdated'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Mod List */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
                {installedMods.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-xs">
                        {loading ? 'Scanning installed mods & checking online updates...' : 'No installed mods found in selected folder.'}
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
                                    <div key={mod.name} className="p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
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

                                                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
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
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(28rem,1fr))] gap-2.5">
                        {isCheckingUpdates ? (
                            <div className="col-span-full text-center py-20 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                <span>Checking for online updates...</span>
                            </div>
                        ) : installedMods.filter(m => m.hasUpdate).length === 0 ? (
                            <div className="col-span-full text-center py-16 text-slate-400 dark:text-zinc-600 text-xs select-none">
                                All installed mods are up to date!
                            </div>
                        ) : (
                            [...installedMods]
                                .filter(m => m.hasUpdate)
                                .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                                .map(mod => {
                                    const activeDownloading = isModDownloading(mod.name);

                                    return (
                                        <div
                                            key={mod.name}
                                            onClick={() => handleToggleSelect(mod.name)}
                                            className={`h-full cursor-pointer bg-white dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl shadow-xs hover:border-slate-300 dark:hover:border-zinc-700/80 hover:shadow-md transition-all duration-200 overflow-hidden ${activeDownloading ? 'opacity-60 pointer-events-none' : ''}`}
                                        >
                                            <div className="h-full p-4 flex flex-col gap-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                                                        <input
                                                            type="checkbox"
                                                            checked={mod.selectedForUpdate || false}
                                                            onChange={() => handleToggleSelect(mod.name)}
                                                            onClick={event => event.stopPropagation()}
                                                            disabled={activeDownloading}
                                                            className="mt-[13px] w-4 h-4 rounded border-slate-400 dark:border-zinc-700 text-indigo-600 cursor-pointer shrink-0"
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
                                                            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
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
                                })
                        )}

                        {updateCount > 0 && (
                            <div className="col-span-full sticky bottom-2 z-20 flex flex-col items-end gap-2 pt-2 pointer-events-none">
                                <button
                                    onClick={handleStartUpdateBatch}
                                    disabled={loading || selectedUpdateCount === 0}
                                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/20 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60 pointer-events-auto"
                                >
                                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    <span>{loading ? 'Resolving Batch...' : `Update Selected Mods (${selectedUpdateCount})`}</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
