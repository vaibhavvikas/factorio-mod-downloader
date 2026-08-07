import React, { useState, useEffect } from 'react';
import { Package, Trash2, Wrench } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../../context/AppContext';
import type { InstalledModItem } from '../../../context/AppContext';
import { LAYER, BORDER, DIVIDER, ANIMATION } from '../../../theme/layers';
import { Tooltip } from '../../ui/Tooltip';
import {
    DeleteModModal,
    DependencyUpgradeConflictModal,
    BulkDeleteModModal,
    BatchUpdateModal,
    type BatchUpdateItem,
} from './InstalledModals';
import {
    computeReverseDependencies,
    calculateDeleteImpact,
    calculateBulkDeleteImpact,
    type ConflictModalData,
    type DeleteModalData,
    type BulkDeleteModalData,
} from '../../../utils/modDependencyUtils';
import { InstalledModsList } from './InstalledModsList';
import { InstalledUpdatesList, UpdatesHeaderActions } from './InstalledUpdatesList';

export const InstalledTab: React.FC = () => {
    const {
        startDownload,
        addLog,
        queue,
        folderPath,
        installedMods,
        setInstalledMods,
        loadingInstalled,
        isCheckingUpdates,
        factorioVersion,
        refreshInstalledMods: loadInstalledMods
    } = useAppContext();
    const [loading, setLoading] = useState(false);
    const isAnyLoading = loading || loadingInstalled;
    const [activeTab, setActiveTab] = useState<'installed' | 'updates'>('installed');

    const [conflictModalData, setConflictModalData] = useState<ConflictModalData | null>(null);
    const [deleteModalData, setDeleteModalData] = useState<DeleteModalData | null>(null);
    const [bulkDeleteModalData, setBulkDeleteModalData] = useState<BulkDeleteModalData | null>(null);
    const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);
    const [singleModTarget, setSingleModTarget] = useState<{
        item: BatchUpdateItem;
        batchItem: { id: string; title: string; version: string; file_name: string; sha1: string };
    } | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (deleteModalData) setDeleteModalData(null);
                if (conflictModalData) setConflictModalData(null);
                if (bulkDeleteModalData) setBulkDeleteModalData(null);
                if (showUpdateConfirmModal) setShowUpdateConfirmModal(false);
                if (singleModTarget) setSingleModTarget(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteModalData, conflictModalData, bulkDeleteModalData, showUpdateConfirmModal, singleModTarget]);

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

    const isModCompatible = (mod: InstalledModItem, targetVersion: string) => {
        if (!targetVersion || targetVersion === 'all' || targetVersion === 'any') return true;
        if (!mod.factorioVersion) return true;
        const cleanTarget = targetVersion.trim().toLowerCase();
        const cleanModFver = mod.factorioVersion.trim().toLowerCase();
        return cleanModFver === cleanTarget || cleanModFver.startsWith(cleanTarget) || cleanTarget.startsWith(cleanModFver);
    };

    const isModInUpdateList = (m: InstalledModItem) =>
        m.hasUpdate || (m.selectedTargetVersion ? m.selectedTargetVersion !== m.version : false);

    const fixableMods = installedMods.filter(isModInUpdateList);
    const incompatibleMods = installedMods.filter(m => !isModCompatible(m, factorioVersion) && !isModInUpdateList(m));

    const handleOpenBulkDeleteModal = () => {
        if (incompatibleMods.length === 0) return;
        const impact = calculateBulkDeleteImpact(incompatibleMods, installedMods);
        setBulkDeleteModalData(impact);
    };

    const handleConfirmBulkDelete = async () => {
        if (!bulkDeleteModalData) return;
        const modsToDelete = [...bulkDeleteModalData.primaryTargetMods, ...bulkDeleteModalData.exclusiveDeps];
        setBulkDeleteModalData(null);
        setLoading(true);
        try {
            for (const mod of modsToDelete) {
                await invoke('delete_installed_mod', { filePath: mod.filePath });
                addLog(`Deleted mod "${mod.title || mod.name}" from mods folder.`, 'success');
            }
            await loadInstalledMods(folderPath);
        } catch (err: any) {
            addLog(`Failed to delete incompatible mods: ${err?.toString()}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenUpdateConfirmModal = () => {
        const selected = installedMods.filter(m => isModInUpdateList(m) && m.selectedForUpdate !== false);
        if (selected.length === 0) return;
        setShowUpdateConfirmModal(true);
    };

    const handleConfirmUpdateBatch = async () => {
        setShowUpdateConfirmModal(false);
        await handleStartUpdateBatch();
    };

    const handleUpdateFixableBatch = async () => {
        if (fixableMods.length === 0) return;
        setInstalledMods(prev =>
            prev.map(m => (isModInUpdateList(m) ? { ...m, selectedForUpdate: true } : m))
        );
        handleOpenUpdateConfirmModal();
    };

    const handleUpdateSingleMod = async (mod: InstalledModItem, targetVersion: string) => {
        setSingleModTarget({
            item: {
                name: mod.name,
                title: mod.title || mod.name,
                fromVersion: mod.version,
                toVersion: targetVersion,
            },
            batchItem: {
                id: mod.name,
                title: mod.title || mod.name,
                version: targetVersion,
                file_name: `${mod.name}_${targetVersion}.zip`,
                sha1: '',
            },
        });
    };

    const handleToggleSelect = (modName: string) => {
        setInstalledMods(prev =>
            prev.map(m => (m.name === modName ? { ...m, selectedForUpdate: !m.selectedForUpdate } : m))
        );
    };

    const handleSelectAll = (select: boolean) => {
        setInstalledMods(prev =>
            prev.map(m => (isModInUpdateList(m) ? { ...m, selectedForUpdate: select } : m))
        );
    };

    const handleSelectVersion = (modName: string, ver: string) => {
        setInstalledMods(prev =>
            prev.map(m => (m.name === modName ? { ...m, selectedTargetVersion: ver, selectedForUpdate: true } : m))
        );
    };

    const handleStartUpdateBatch = async () => {
        const selected = installedMods.filter(m => isModInUpdateList(m) && m.selectedForUpdate !== false);
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

    const updateCount = installedMods.filter(isModInUpdateList).length;
    const selectedUpdateCount = installedMods.filter(m => isModInUpdateList(m) && m.selectedForUpdate !== false).length;
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

            <div className="relative flex flex-col flex-1 min-h-0 panel-content">
                <div className={`relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-md ${BORDER.outer} ${LAYER.viewportGlass}`}>
                    {installedMods.length > 0 && (
                          <div className={`relative shrink-0 border-b ${DIVIDER.outer} ${LAYER.contentCard} px-4 h-9 flex items-center justify-between rounded-t-md`}>
                             <div className="inline-flex gap-6 h-full text-xs font-bold select-none">
                                 <button
                                     onClick={() => setActiveTab('installed')}
                                     className={`relative h-full flex items-center gap-1.5 ${ANIMATION.tabButton} cursor-pointer ${
                                         activeTab === 'installed'
                                             ? 'text-blue-600 dark:text-blue-400'
                                             : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                     }`}
                                 >
                                     <Package className={`w-3.5 h-3.5 ${activeTab === 'installed' ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                                     <span>Installed Mods</span>
                                     <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${activeTab === 'installed' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-zinc-700/60 text-slate-600 dark:text-zinc-300'}`}>
                                         {installedMods.length}
                                     </span>
                                     {activeTab === 'installed' && (
                                         <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-in fade-in zoom-in-95 duration-150" />
                                     )}
                                 </button>
                                 <button
                                     onClick={() => setActiveTab('updates')}
                                     className={`relative h-full flex items-center gap-1.5 ${ANIMATION.tabButton} cursor-pointer ${
                                         activeTab === 'updates'
                                             ? 'text-blue-600 dark:text-blue-400'
                                             : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                     }`}
                                 >
                                     <Wrench className={`w-3.5 h-3.5 ${activeTab === 'updates' ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                                     <span>Action Required</span>
                                     {updateCount > 0 && (
                                         <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                             {updateCount}
                                         </span>
                                     )}
                                     {activeTab === 'updates' && (
                                         <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-in fade-in zoom-in-95 duration-150" />
                                     )}
                                 </button>
                             </div>
                             <div className="flex items-center gap-2 select-none">
                                {activeTab === 'installed' && (
                                    <>
                                        {fixableMods.length > 0 && (
                                            <Tooltip content={`Apply fixes for ${fixableMods.length} mod(s)`}>
                                                <button
                                                    onClick={handleUpdateFixableBatch}
                                                    className="px-2.5 py-1 rounded-md font-bold text-[11px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 dark:border-amber-400/30 hover:bg-amber-500/20 dark:hover:bg-amber-400/30 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                                                >
                                                    <Wrench className="w-3 h-3 text-amber-500 shrink-0" />
                                                    <span>Action Required ({fixableMods.length})</span>
                                                </button>
                                            </Tooltip>
                                        )}

                                        {factorioVersion !== 'all' && factorioVersion !== 'any' && incompatibleMods.length > 0 && (
                                            <Tooltip content={`Remove ${incompatibleMods.length} mod(s) incompatible with Factorio ${factorioVersion}`}>
                                                <button
                                                    onClick={handleOpenBulkDeleteModal}
                                                    className="px-2.5 py-1 rounded-md font-bold text-[11px] bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 dark:border-rose-400/30 hover:bg-rose-500/20 dark:hover:bg-rose-400/30 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                                                >
                                                    <Trash2 className="w-3 h-3 text-rose-500 shrink-0" />
                                                    <span>Remove Incompatible ({incompatibleMods.length})</span>
                                                </button>
                                            </Tooltip>
                                        )}
                                    </>
                                )}

                                {activeTab === 'updates' && (
                                    <UpdatesHeaderActions
                                        updateCount={updateCount}
                                        allUpdatesSelected={allUpdatesSelected}
                                        onSelectAll={handleSelectAll}
                                        isCheckingUpdates={isCheckingUpdates}
                                        modsCheckedCount={installedMods.filter(m => m.thumbnail !== undefined || m.category !== undefined || m.hasUpdate || m.latestVersion !== undefined).length}
                                        totalMods={installedMods.length}
                                    />
                                )}
                             </div>
                         </div>
                    )}
                    <div className="relative flex-1 min-h-0">
                        <div className="scroller-panel card h-full">
                            {installedMods.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-zinc-600 text-xs">
                                    {isAnyLoading ? 'Scanning installed mods...' : 'No installed mods found in selected folder.'}
                                </div>
                            ) : activeTab === 'installed' ? (
                                <div key="subtab-installed" className={`w-full ${ANIMATION.subTabPane}`}>
                                    <InstalledModsList
                                        mods={installedMods}
                                        dependentsMap={dependentsMap}
                                        onOpenDeleteModal={handleOpenDeleteModal}
                                        onUpdateMod={handleUpdateSingleMod}
                                    />
                                </div>
                            ) : (
                                <div key="subtab-updates" className={`w-full ${ANIMATION.subTabPane}`}>
                                     <InstalledUpdatesList
                                         mods={installedMods}
                                         queue={queue}
                                         isCheckingUpdates={isCheckingUpdates}
                                         isAnyLoading={isAnyLoading}
                                         selectedUpdateCount={selectedUpdateCount}
                                         onToggleSelect={handleToggleSelect}
                                         onSelectVersion={handleSelectVersion}
                                         onStartUpdateBatch={handleOpenUpdateConfirmModal}
                                     />
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>

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
                    onProceed={async (batch) => {
                        setConflictModalData(null);
                        await executeDownloadBatch(batch);
                    }}
                />
            )}

            {bulkDeleteModalData && (
                <BulkDeleteModModal
                    data={bulkDeleteModalData}
                    onConfirm={handleConfirmBulkDelete}
                    onClose={() => setBulkDeleteModalData(null)}
                />
            )}

            {showUpdateConfirmModal && (
                <BatchUpdateModal
                    updates={installedMods
                        .filter(m => isModInUpdateList(m) && m.selectedForUpdate !== false)
                        .map(m => ({
                            name: m.name,
                            title: m.title || m.name,
                            fromVersion: m.version,
                            toVersion: m.selectedTargetVersion || m.latestVersion || m.version,
                        }))}
                    onClose={() => setShowUpdateConfirmModal(false)}
                    onConfirm={handleConfirmUpdateBatch}
                    isResolving={loading}
                />
            )}

            {singleModTarget && (
                <BatchUpdateModal
                    updates={[singleModTarget.item]}
                    onClose={() => setSingleModTarget(null)}
                    onConfirm={async () => {
                        const target = singleModTarget;
                        setSingleModTarget(null);
                        setLoading(true);
                        try {
                            const resolvedBatch = await invoke<{ id: string; title: string; version: string; file_name: string; sha1: string }[]>('resolve_download_batch', {
                                mainMods: [target.batchItem],
                                directDeps: [],
                                includeRecommended: false
                            });
                            await executeDownloadBatch(resolvedBatch);
                        } catch (err: any) {
                            addLog(`Failed to update ${target.item.title}: ${err?.toString()}`, 'error');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    isResolving={loading}
                />
            )}
        </div>
    );
};
