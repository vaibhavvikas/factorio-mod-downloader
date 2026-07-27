import React, { useState, useEffect } from 'react';
import { FolderOpen, FolderSearch, FolderOutput, RefreshCw, Package, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../../context/AppContext';
import type { InstalledModItem } from '../../../context/AppContext';
import { LAYER, BORDER, DIVIDER, INTERACTIVE } from '../../../theme/layers';
import {
    DeleteModModal,
    DependencyUpgradeConflictModal,
    computeReverseDependencies,
    calculateDeleteImpact,
    type ConflictModalData,
    type DeleteModalData,
} from './InstalledModals';
import { InstalledModsList } from './InstalledModsList';
import { InstalledUpdatesList, UpdatesHeaderActions } from './InstalledUpdatesList';

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

    const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);
    const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);

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

    const dependentsMap = computeReverseDependencies(installedMods);

    const handleOpenDeleteModal = (mod: InstalledModItem) => {
        const dependents = dependentsMap.get(mod.name) || [];
        if (dependents.length > 0) return;

        const impact = calculateDeleteImpact(mod, installedMods);
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

    const updateCount = installedMods.filter(m => m.hasUpdate).length;
    const selectedUpdateCount = installedMods.filter(m => m.hasUpdate && m.selectedForUpdate).length;
    const allUpdatesSelected = updateCount > 0 && selectedUpdateCount === updateCount;

    return (
        <div className={`flex-1 flex flex-col overflow-hidden h-full ${LAYER.appCanvas} relative`}>
            {deleteModalData && (
                <DeleteModModal
                    data={deleteModalData}
                    onClose={() => setDeleteModalData(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}

            {conflictModalData && (
                <DependencyUpgradeConflictModal
                    data={conflictModalData}
                    onClose={() => setConflictModalData(null)}
                    onProceed={(batch) => {
                        setConflictModalData(null);
                        executeDownloadBatch(batch);
                    }}
                />
            )}

            <div className="pt-3 px-3 pb-0 shrink-0 flex flex-col gap-4">
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
                            className={`${INTERACTIVE.secondary} p-1.5 rounded-lg ${BORDER.inner} cursor-pointer transition-colors`}
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
                            className={`${INTERACTIVE.secondary} p-1.5 rounded-lg ${BORDER.inner} cursor-pointer transition-colors`}
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
                            className={`${INTERACTIVE.secondary} p-1.5 rounded-lg ${BORDER.inner} cursor-pointer transition-colors disabled:opacity-50`}
                            title="Refresh Installed Mods"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isAnyLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative flex flex-col flex-1 min-h-0 px-3 pt-3 pb-2">
                <div className={`relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl ${BORDER.outer} ${LAYER.viewportGlass}`}>
                    {installedMods.length > 0 && (
                        <div className={`relative shrink-0 border-b ${DIVIDER.outer} ${LAYER.viewportHeader} px-3 pt-3 pb-0 flex items-start justify-between`}>
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
                            {activeTab === 'updates' && (
                                <UpdatesHeaderActions
                                    updateCount={updateCount}
                                    allUpdatesSelected={allUpdatesSelected}
                                    onSelectAll={handleSelectAll}
                                />
                            )}
                        </div>
                    )}
                    <div className="relative flex-1 min-h-0">
                        <div className="scroller-panel card h-full">
                            {installedMods.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-xs">
                                    {isAnyLoading ? 'Scanning installed mods & checking online updates...' : 'No installed mods found in selected folder.'}
                                </div>
                            ) : activeTab === 'installed' ? (
                                <InstalledModsList
                                    mods={installedMods}
                                    dependentsMap={dependentsMap}
                                    onOpenDeleteModal={handleOpenDeleteModal}
                                />
                            ) : (
                                <InstalledUpdatesList
                                    mods={installedMods}
                                    queue={queue}
                                    isCheckingUpdates={isCheckingUpdates}
                                    isAnyLoading={isAnyLoading}
                                    selectedUpdateCount={selectedUpdateCount}
                                    onToggleSelect={handleToggleSelect}
                                    onSelectVersion={handleSelectVersion}
                                    onStartUpdateBatch={handleStartUpdateBatch}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
