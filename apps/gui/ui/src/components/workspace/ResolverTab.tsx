import React, { useState } from 'react';
import { FileText, Download, Inbox, Loader2, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../context/AppContext';
import { ModAccordionCard } from './ModAccordionCard';
import type { TargetModItem } from './ModAccordionCard';
import type { TreeNode, DependencyType } from './DependencyTree';

interface BackendDependency {
    id: string;
    ineq: string;
    version: string;
}

interface BackendDependencies {
    required: BackendDependency[];
    recommended: BackendDependency[];
    optional: BackendDependency[];
    incompatible: BackendDependency[];
}

interface BackendModDetails {
    name: string;
    title: string;
    owner: string;
    category: string;
    summary: string;
    thumbnail?: string;
    updated_at?: string;
    downloads_count: number;
    releases: {
        version: string;
        factorio_version: string;
        released_at: string;
        dependencies: BackendDependencies;
    }[];
    default_dependencies: BackendDependencies;
}

interface BackendResolvedDownloadItem {
    id: string;
    title: string;
    version: string;
    file_name: string;
    sha1: string;
}

export interface ResolverTabProps {
    targetMods?: TargetModItem[];
    setTargetMods?: React.Dispatch<React.SetStateAction<TargetModItem[]>>;
    parseAndAddMods?: (text: string) => Promise<void>;
    loading?: boolean;
}

export const ResolverTab: React.FC<ResolverTabProps> = ({
    targetMods: externalTargetMods,
    setTargetMods: externalSetTargetMods,
    parseAndAddMods: externalParseAndAddMods,
    loading: externalLoading,
}) => {
    const { startDownload, addLog } = useAppContext();
    const [localTargetMods, setLocalTargetMods] = useState<TargetModItem[]>([]);
    const [expandedModId, setExpandedModId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const [isResolvingBatch, setIsResolvingBatch] = useState(false);

    const targetMods = externalTargetMods !== undefined ? externalTargetMods : localTargetMods;
    const setTargetMods = externalSetTargetMods || setLocalTargetMods;
    const loading = externalLoading !== undefined ? externalLoading : localLoading;
    const setLoading = setLocalLoading;
    const isBusy = isResolvingBatch || loading || externalLoading === true;

    // Convert flat backend dependencies to tree nodes
    const convertBackendDepsToTree = (deps: BackendDependencies): TreeNode[] => {
        const treeNodes: TreeNode[] = [];

        const mapDep = (dep: BackendDependency, type: DependencyType): TreeNode => ({
            id: `dep-${dep.id}-${Math.random()}`,
            name: String(dep.id),
            version: String(dep.version || ''),
            size: 15.0, // fallback estimate
            type: type,
        });

        deps.required.forEach(d => treeNodes.push(mapDep(d, 'required')));
        deps.recommended.forEach(d => treeNodes.push(mapDep(d, 'recommended')));
        deps.optional.forEach(d => treeNodes.push(mapDep(d, 'optional')));
        deps.incompatible.forEach(d => treeNodes.push(mapDep(d, 'incompatible')));

        return treeNodes;
    };

    // Extract mod names from URLs or text query and fetch from Backend!
    const internalParseAndAddMods = async (text: string) => {
        addLog(`Analyzing query: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`, 'info');
        const rawEntries = text.split(/[\n\r,]+/);
        const newModNames: string[] = [];

        rawEntries.forEach(entry => {
            const trimmed = entry.trim();
            if (!trimmed) return;

            let modName = trimmed;
            try {
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    const url = new URL(trimmed);
                    const pathParts = url.pathname.split('/').filter(Boolean);
                    const modIdx = pathParts.indexOf('mod');
                    if (modIdx !== -1 && pathParts[modIdx + 1]) {
                        modName = pathParts[modIdx + 1];
                    } else {
                        modName = pathParts[pathParts.length - 1];
                    }
                }
            } catch (e) {
                // Ignore URL parsing errors
            }

            modName = modName.split(/[?#]/)[0].trim();
            if (modName && !newModNames.includes(modName)) {
                newModNames.push(modName);
            }
        });

        if (newModNames.length === 0) {
            addLog('No valid mod names or URLs identified.', 'warn');
            return;
        }

        setLoading(true);

        for (const modId of newModNames) {
            try {
                addLog(`Loading mod info for "${modId}"...`, 'info');

                // Call real Tauri Backend command!
                const details = await invoke<BackendModDetails>('fetch_mod_details', { modId });

                const reversedReleases = details.releases.slice().reverse();
                const latestVersion = reversedReleases[0]?.version || 'latest';
                const formattedVer = latestVersion.startsWith('v') ? latestVersion : `v${latestVersion}`;

                addLog(`Loaded mod info for "${details.title || details.name}" (latest ${formattedVer})`, 'success');

                const treeDeps = convertBackendDepsToTree(details.default_dependencies);
                const initialSelectedIds = treeDeps
                    .filter(d => d.type === 'required' || d.type === 'recommended')
                    .map(d => d.id);

                const newCard: TargetModItem = {
                    id: 'mod-' + Date.now() + '-' + Math.random(),
                    name: details.name,
                    title: details.title || details.name,
                    author: details.owner || 'Author',
                    category: details.category || 'content',
                    summary: details.summary || '',
                    thumbnail: details.thumbnail,
                    updatedAt: details.updated_at,
                    downloadsCount: details.downloads_count || 0,
                    selectedVersion: latestVersion,
                    availableReleases: reversedReleases.map(r => ({
                        version: r.version,
                        factorio_version: r.factorio_version,
                        released_at: r.released_at,
                        dependencies: r.dependencies,
                    })),
                    selectedDepIds: initialSelectedIds,
                    dependencies: treeDeps
                };

                setTargetMods((prev: TargetModItem[]) => {
                    if (prev.some(m => m.name === details.name)) return prev;
                    return [...prev, newCard];
                });
            } catch (err: any) {
                const errStr = err?.toString() || '';
                const is404 = errStr.includes('404') || errStr.includes('Not Found');
                const userMsg = is404
                    ? `Failed to fetch mod "${modId}": Mod not found on Factorio Mod Portal. Please check the mod ID.`
                    : `Failed to fetch mod "${modId}": Unable to load mod details. Please try again.`;
                addLog(userMsg, 'error');
            }
        }

        setLoading(false);
    };

    const parseAndAddMods = externalParseAndAddMods || internalParseAndAddMods;

    const handleToggleDep = (modId: string, depId: string) => {
        setTargetMods((prev: TargetModItem[]) => prev.map((m: TargetModItem) => {
            if (m.id !== modId) return m;
            const exists = m.selectedDepIds.includes(depId);
            const updated = exists
                ? m.selectedDepIds.filter(id => id !== depId)
                : [...m.selectedDepIds, depId];
            return { ...m, selectedDepIds: updated };
        }));
    };

    const handleToggleSection = (modId: string, type: 'recommended' | 'optional', selectAll: boolean) => {
        setTargetMods((prev: TargetModItem[]) => prev.map((m: TargetModItem) => {
            if (m.id !== modId) return m;
            const sectionNodes = m.dependencies.filter(d => d.type === type);
            const sectionIds = sectionNodes.map(d => d.id);

            let updated: string[];
            if (selectAll) {
                const toAdd = sectionIds.filter(id => !m.selectedDepIds.includes(id));
                updated = [...m.selectedDepIds, ...toAdd];
            } else {
                updated = m.selectedDepIds.filter(id => !sectionIds.includes(id));
            }
            return { ...m, selectedDepIds: updated };
        }));
    };

    const handleSelectVersion = (id: string, version: string) => {
        setTargetMods((prev: TargetModItem[]) => prev.map((m: TargetModItem) => {
            if (m.id !== id) return m;

            // Find pre-loaded release data from availableReleases
            const targetRelease = m.availableReleases.find(r => r.version === version);

            if (!targetRelease || !targetRelease.dependencies) {
                return { ...m, selectedVersion: version };
            }

            const treeDeps = convertBackendDepsToTree(targetRelease.dependencies);
            const initialSelectedIds = treeDeps
                .filter(d => d.type === 'required' || d.type === 'recommended')
                .map(d => d.id);

            addLog(`Switched "${m.title}" → v${version} (instant, using cached release info)`, 'info');

            return {
                ...m,
                selectedVersion: version,
                dependencies: treeDeps,
                selectedDepIds: initialSelectedIds,
            };
        }));
    };

    const handleRemoveMod = (id: string) => {
        setTargetMods((prev: TargetModItem[]) => prev.filter((m: TargetModItem) => m.id !== id));
    };

    const handleAddClick = () => {
        if (!inputText.trim()) return;
        parseAndAddMods(inputText);
        setInputText('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseAndAddMods(text);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleStartDownloadAll = async () => {
        if (targetMods.length === 0 || isBusy) return;

        setIsResolvingBatch(true);
        addLog(`Resolving dependencies and compatibility tree for ${targetMods.length} target mod(s)...`, 'info');

        try {
            // Build main mods list from selected cards
            const mainMods: BackendResolvedDownloadItem[] = targetMods.map(t => ({
                id: t.name,
                title: t.title || t.name,
                version: t.selectedVersion,
                file_name: `${t.name}_${t.selectedVersion}.zip`,
                sha1: '',
            }));

            // Collect direct dependencies enabled by user toggles
            const directDeps: BackendDependency[] = [];
            targetMods.forEach(t => {
                t.dependencies.forEach(d => {
                    if (t.selectedDepIds.includes(d.id)) {
                        directDeps.push({
                            id: d.name,
                            ineq: '=',
                            version: d.version,
                        });
                    }
                });
            });

            // Call backend prepare_download_batch via Tauri invoke!
            const resolvedBatch = await invoke<BackendResolvedDownloadItem[]>('resolve_download_batch', {
                mainMods,
                directDeps,
                includeRecommended: true
            });

            addLog(`Dependency resolution complete: ${resolvedBatch.length} mod(s) prepared for download.`, 'success');

            // Fetch target mods directory
            let modsFolder = await invoke<string | null>('get_mods_folder');
            if (!modsFolder) {
                modsFolder = await invoke<string>('detect_default_mods_folder');
            }

            // Trigger real Rust backend download queue!
            await invoke('start_download_batch', {
                items: resolvedBatch,
                outputDir: modsFolder
            });

            // Pass resolved batch to context download manager
            startDownload(
                resolvedBatch.map(item => ({
                    id: item.id,
                    name: item.title || item.id,
                    version: item.version,
                    size: 25.0,
                })),
                'download'
            );
        } catch (err: any) {
            addLog(`Failed to resolve download batch: ${err?.toString() || 'Unknown error'}`, 'error');
        } finally {
            setIsResolvingBatch(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-slate-100 dark:bg-zinc-950 relative">
            {/* Input Bar Section */}
            <div className="pt-3 px-6 pb-2 shrink-0 flex flex-col gap-4">
                <div className="h-10 px-3.5 py-1.5 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between shadow-xs gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddClick();
                            }}
                            placeholder="Paste Factorio Mod URL (e.g. mods.factorio.com/mod/Krastorio2) or type mod name..."
                            className="bg-transparent border-none text-xs text-slate-800 dark:text-zinc-100 focus:outline-none w-full font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => document.getElementById('file-import')?.click()}
                            className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-zinc-800/80 cursor-pointer flex items-center gap-1.5 transition-colors"
                            title="Import mod list from text file"
                        >
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Import .txt</span>
                        </button>
                        <button
                            onClick={handleAddClick}
                            disabled={isBusy}
                            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            <span>{isBusy ? 'Fetching...' : 'Add Mods'}</span>
                        </button>
                    </div>
                    <input
                        type="file"
                        id="file-import"
                        accept=".txt"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            {/* Only cards scroll; the queue input remains persistent above them. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
                <div className="flex flex-col gap-4">
                    {targetMods.length === 0 ? (
                        <div className="text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                            <div className="p-4 rounded-full bg-slate-200/50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-indigo-500">
                                <Inbox className="w-8 h-8 stroke-[1.2]" />
                            </div>
                            <div className="flex flex-col gap-1 max-w-[280px] text-center select-none">
                                <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">No target mods added</span>
                                <span className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">Paste mod URLs or import a text file to inspect target mods, toggle recommended/optional dependencies, and download.</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {[...targetMods]
                                .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
                                .map((mod: TargetModItem) => (
                                    <ModAccordionCard
                                        key={mod.id}
                                        mod={mod}
                                        isExpanded={expandedModId === mod.id}
                                        onToggleExpand={() => setExpandedModId(expandedModId === mod.id ? null : mod.id)}
                                        onToggleDep={handleToggleDep}
                                        onToggleSection={handleToggleSection}
                                        onSelectVersion={handleSelectVersion}
                                        onRemove={handleRemoveMod}
                                    />
                                ))}

                            {/* Sticky Compact Download Action Button */}
                            <div className="sticky bottom-1 z-20 flex flex-col items-end gap-2 pt-1 pointer-events-none">
                                <button
                                    onClick={handleStartDownloadAll}
                                    disabled={isBusy}
                                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/20 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60 pointer-events-auto"
                                >
                                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    <span>{isBusy ? 'Resolving Dependencies...' : `Download All (${targetMods.length} Target Mods)`}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
