import React, { useState, useEffect } from 'react';
import { FileText, Download, Inbox, Loader2, Search, ChevronDown, Layers, LayoutGrid } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../../../context/AppContext';
import { ModAccordionCard } from './ModAccordionCard';
import type { TargetModItem } from './ModAccordionCard';
import type { TreeNode, DependencyType } from './DependencyTree';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE, DEPENDENCY_TYPE } from '../../../theme/layers';
import {
    getInitialSelectedDepIds,
    getQueueAutoIncludeSettings,
    QUEUE_AUTO_OPTIONAL_KEY,
    QUEUE_AUTO_RECOMMENDED_KEY,
} from './queueAutoSelect';
import { QueueSettingsDropdown } from './QueueSettingsDropdown';

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

interface DependencyTreeNodeProps {
    name: string;
    versionReq: string;
    type?: DependencyType | 'root';
    targetMods: TargetModItem[];
    treeCache: Record<string, TargetModItem>;
    visited: Set<string>;
    depth: number;
}

const DependencyTreeNode: React.FC<DependencyTreeNodeProps> = ({
    name,
    versionReq,
    type = 'root',
    targetMods,
    treeCache,
    visited,
    depth,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Find if we have details (a card) for this dependency in our targetMods queue or treeCache
    const modDetails = targetMods.find(m => m.name === name) || treeCache[name];
    
    // Determine title
    const displayTitle = modDetails ? (modDetails.title || modDetails.name) : name;
    
    // Detect recursion cycles
    const hasCycle = visited.has(name);
    const newVisited = new Set(visited).add(name);
    
    // Get sub-dependencies from details if present (excluding incompatible)
    const directDeps = modDetails 
        ? modDetails.dependencies.filter(d => d.type !== 'incompatible')
        : [];
        
    // Filter sub-dependencies to only show checked ones in cards
    const activeSubDeps = directDeps.filter(d => {
        if (d.type === 'required') return true;
        // If it is recommended or optional, it must be selected in the card's checkbox
        return modDetails?.selectedDepIds.includes(d.id);
    });

    // Sort sub-dependencies by type rank (required -> recommended -> optional), then alphabetically by display title
    const typeRank: Record<string, number> = {
        required: 1,
        recommended: 2,
        optional: 3,
    };

    const sortedSubDeps = [...activeSubDeps].sort((a, b) => {
        const rankA = typeRank[a.type] || 99;
        const rankB = typeRank[b.type] || 99;
        if (rankA !== rankB) {
            return rankA - rankB;
        }
        const titleA = (targetMods.find(m => m.name === a.name) || treeCache[a.name])?.title || a.name;
        const titleB = (targetMods.find(m => m.name === b.name) || treeCache[b.name])?.title || b.name;
        return titleA.localeCompare(titleB);
    });

    const hasChildren = sortedSubDeps.length > 0 && !hasCycle;

    const iconColorClass = {
        root: 'text-slate-400 dark:text-zinc-500',
        required: 'text-sky-500 dark:text-sky-400',
        recommended: 'text-indigo-500 dark:text-indigo-400',
        optional: 'text-violet-500 dark:text-violet-400',
        incompatible: 'text-rose-500 dark:text-rose-400',
    }[type];

    return (
        <div className="flex flex-col">
            {/* Tree Node Row */}
            <div 
                className="flex items-center gap-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg px-2 group cursor-pointer select-none transition-colors" 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    if (hasChildren) setIsExpanded(!isExpanded); 
                }}
            >
                {/* Chevron spacing / VS Code guide lines */}
                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                    {hasChildren ? (
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    ) : (
                        <div className="w-3.5 h-3.5" />
                    )}
                </div>

                {/* Folder/Package Icon */}
                <span className={`shrink-0 ${iconColorClass}`}>
                    <Layers className="w-3.5 h-3.5" />
                </span>

                {/* Mod Title */}
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-50 truncate max-w-[320px]">
                    {displayTitle}
                </span>

                {/* Mod ID / Name Code style */}
                <span className={`text-[11px] font-mono text-slate-400 dark:text-zinc-500 ${LAYER.pillSurface} px-1.5 py-0.5 rounded ${BORDER.pill} truncate`}>
                    {name}
                </span>

                {/* Version Requirement Badge */}
                {versionReq && (
                    <span className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400">
                        {versionReq}
                    </span>
                )}



                {/* Recursion / Cycle warning */}
                {hasCycle && (
                    <span className="text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/25 px-1.5 py-0.2 rounded-full shrink-0 font-mono">
                        cycle detected
                    </span>
                )}
            </div>

            {/* Sub-dependencies Indented rendering with vertical dashed guide lines */}
            {hasChildren && isExpanded && (
                <div className="relative border-l border-dashed border-slate-300 dark:border-zinc-700 ml-4 pl-3.5 flex flex-col my-0.5">
                    {sortedSubDeps.map(dep => (
                        <DependencyTreeNode
                            key={dep.id}
                            name={dep.name}
                            versionReq={dep.version}
                            type={dep.type}
                            targetMods={targetMods}
                            treeCache={treeCache}
                            visited={newVisited}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

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
    const targetMods = externalTargetMods !== undefined ? externalTargetMods : localTargetMods;
    const setTargetMods = externalSetTargetMods || setLocalTargetMods;
    const [localLoading, setLocalLoading] = useState(false);
    const loading = externalLoading !== undefined ? externalLoading : localLoading;
    const setLoading = setLocalLoading;
    const [expandedModId, setExpandedModId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [isResolvingBatch, setIsResolvingBatch] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'tree'>('cards');
    const [treeCache, setTreeCache] = useState<Record<string, TargetModItem>>({});
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [autoIncludeRecommended, setAutoIncludeRecommended] = useState<boolean>(() => {
        return getQueueAutoIncludeSettings().recommended;
    });
    const [autoIncludeOptional, setAutoIncludeOptional] = useState<boolean>(() => {
        return getQueueAutoIncludeSettings().optional;
    });

    // Sync selectedDepIds on targetMods when autoIncludeRecommended setting changes
    const handleToggleAutoIncludeRecommended = (enabled: boolean) => {
        setAutoIncludeRecommended(enabled);
        localStorage.setItem(QUEUE_AUTO_RECOMMENDED_KEY, String(enabled));
        const settings = { recommended: enabled, optional: autoIncludeOptional };
        setTargetMods((prev: TargetModItem[]) =>
            prev.map(mod => ({
                ...mod,
                selectedDepIds: getInitialSelectedDepIds(mod.dependencies, settings),
            }))
        );
    };

    // Sync selectedDepIds on targetMods when autoIncludeOptional setting changes
    const handleToggleAutoIncludeOptional = (enabled: boolean) => {
        setAutoIncludeOptional(enabled);
        localStorage.setItem(QUEUE_AUTO_OPTIONAL_KEY, String(enabled));
        const settings = { recommended: autoIncludeRecommended, optional: enabled };
        setTargetMods((prev: TargetModItem[]) =>
            prev.map(mod => ({
                ...mod,
                selectedDepIds: getInitialSelectedDepIds(mod.dependencies, settings),
            }))
        );
    };

    // Auto-clear cache when targetMods is cleared
    useEffect(() => {
        if (targetMods.length === 0) {
            setTreeCache({});
        }
    }, [targetMods.length]);

    // On-demand tree resolving trigger
    useEffect(() => {
        if (viewMode === 'tree') {
            resolveAndFetchTreeDeps();
        }
    }, [viewMode, targetMods]);

    const resolveAndFetchTreeDeps = async () => {
        if (targetMods.length === 0 || isLoadingTree) return;
        setIsLoadingTree(true);
        addLog('Resolving dependency tree for graph explorer...', 'info');

        try {
            // 1. Prepare inputs for resolver:
            const mainMods = targetMods.map(t => ({
                id: t.name,
                title: t.title || t.name,
                version: t.selectedVersion,
                file_name: `${t.name}_${t.selectedVersion}.zip`,
                sha1: '',
            }));

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

            // 2. Call backend resolve_download_batch to get all resolved items:
            const resolvedBatch = await invoke<BackendResolvedDownloadItem[]>('resolve_download_batch', {
                mainMods,
                directDeps,
                includeRecommended: true
            });

            // 3. Find which resolved items are not in targetMods and not in treeCache:
            const missingNames = resolvedBatch.filter(item => {
                const inTargetMods = targetMods.some(m => m.name === item.id);
                const inCache = !!treeCache[item.id];
                return !inTargetMods && !inCache;
            });

            if (missingNames.length > 0) {
                addLog(`Fetching details for ${missingNames.length} tree dependencies...`, 'info');
                
                // Fetch in parallel:
                const fetchedDetails = await Promise.all(
                    missingNames.map(async (item) => {
                        try {
                            const details = await invoke<BackendModDetails>('fetch_mod_details', { modId: item.id });
                            return details;
                        } catch (e) {
                            addLog(`Failed to fetch tree dependency "${item.id}": ${e}`, 'warn');
                            return null;
                        }
                    })
                );

                // Convert details to TargetModItem and put in cache:
                const newCacheUpdates: Record<string, TargetModItem> = {};
                
                fetchedDetails.forEach(details => {
                    if (!details) return;
                    
                    const reversedReleases = details.releases.slice().reverse();
                    const latestVersion = reversedReleases[0]?.version || 'latest';
                    
                    const treeDeps = convertBackendDepsToTree(details.default_dependencies);
                    const initialSelectedIds = getInitialSelectedDepIds(treeDeps);
                        
                    newCacheUpdates[details.name] = {
                        id: 'tree-' + details.name + '-' + Math.random(),
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
                });

                setTreeCache(prev => ({ ...prev, ...newCacheUpdates }));
            }
            
            addLog('Dependency tree resolved successfully.', 'success');
        } catch (e) {
            addLog(`Failed to resolve dependency tree: ${e}`, 'error');
        } finally {
            setIsLoadingTree(false);
        }
    };

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
                const initialSelectedIds = getInitialSelectedDepIds(treeDeps, {
                    recommended: autoIncludeRecommended,
                    optional: autoIncludeOptional,
                });

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
            const initialSelectedIds = getInitialSelectedDepIds(treeDeps, {
                recommended: autoIncludeRecommended,
                optional: autoIncludeOptional,
            });

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
            // Note: includeRecommended is set to false here so sub-dependencies ONLY pull required dependencies.
            const resolvedBatch = await invoke<BackendResolvedDownloadItem[]>('resolve_download_batch', {
                mainMods,
                directDeps,
                includeRecommended: false
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

    const getRootMods = () => {
        // Collect all dependency names that are checked/selected in the cards
        const allDepNames = new Set<string>();
        targetMods.forEach(m => {
            m.dependencies.forEach(d => {
                if (d.type === 'required' || m.selectedDepIds.includes(d.id)) {
                    allDepNames.add(d.name);
                }
            });
        });
        
        // Also check treeCache to see what is required
        Object.values(treeCache).forEach(m => {
            m.dependencies.forEach(d => {
                if (d.type === 'required' || m.selectedDepIds.includes(d.id)) {
                    allDepNames.add(d.name);
                }
            });
        });
        
        // Root mods are targetMods whose name is NOT in allDepNames
        const roots = targetMods.filter(m => !allDepNames.has(m.name));
        
        // If there's a cycle or empty, fall back to all targetMods
        if (roots.length === 0) return targetMods;
        return roots;
    };

    const renderDependencyTreePanel = () => {
        if (isLoadingTree) {
            return (
                <div className={`flex flex-col ${LAYER.groupPanel} rounded-2xl ${BORDER.card} shadow-xs items-center justify-center p-6 ${TEXT.muted} gap-3 select-none`}>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <div className="flex flex-col gap-1 text-center max-w-[320px]">
                        <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">
                            Resolving Dependency Graph
                        </span>
                        <span className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
                            Fetching details for sub-dependencies to build the complete recursive graph...
                        </span>
                    </div>
                </div>
            );
        }

        const rootMods = getRootMods();

        return (
            <div className={`flex flex-col ${LAYER.groupPanel} ${BORDER.card} shadow-xs overflow-hidden rounded-2xl animate-fade-in`}>
            {/* Header section identical to Download Manager */}
            <div className={`h-8.5 min-h-8.5 px-3.5 border-b ${DIVIDER.outer} flex items-center justify-between ${LAYER.viewportHeader} shrink-0 select-none`}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Dependency Graph Explorer</span>
                    <span className={`${LAYER.pillSurface} ${BORDER.pill} text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-slate-700 dark:text-zinc-300`}>
                        {targetMods.length + Object.keys(treeCache).length} resolved
                    </span>
                </div>

                {/* Inline Color Legend */}
                <div className={`flex items-center gap-3 text-[10px] ${TEXT.muted} font-medium select-none ml-auto mr-1.5 shrink-0`}>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 shrink-0" /> Root</span>
                    <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DEPENDENCY_TYPE.required.dot}`} /> Required</span>
                    <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DEPENDENCY_TYPE.recommended.dot}`} /> Recommended</span>
                    <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DEPENDENCY_TYPE.optional.dot}`} /> Optional</span>
                </div>
            </div>

            {/* Tree content — sizes naturally to content. The outer scroll
                container handles overflow when the tree is tall.
                Padding matches .scroller-panel.tree (24×24 visual frame: p-6 pr-4)
                without overflow-y:auto so scroll events pass through
                to the outer container. */}
            <div className="flex flex-col gap-1 p-6 pr-4">
                {[...rootMods].sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name)).map(m => (
                    <DependencyTreeNode
                        key={m.id}
                        name={m.name}
                        versionReq={m.selectedVersion}
                        type="root"
                        targetMods={targetMods}
                        treeCache={treeCache}
                        visited={new Set()}
                        depth={0}
                    />
                ))}
            </div>
        </div>
    );
};

    return (
        <div className={`flex h-full min-h-0 flex-col ${LAYER.appCanvas} relative`}>
            {/* Input Bar Section */}
            <div className="pt-3 px-3 pb-0 shrink-0 flex flex-col gap-4">
                <div className={`h-10 pl-3.5 pr-1.5 py-1.5 ${LAYER.toolbar} ${BORDER.toolbar} rounded-xl flex items-center justify-between shadow-xs gap-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all`}>
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
                        <QueueSettingsDropdown
                            autoIncludeRecommended={autoIncludeRecommended}
                            autoIncludeOptional={autoIncludeOptional}
                            onToggleRecommended={handleToggleAutoIncludeRecommended}
                            onToggleOptional={handleToggleAutoIncludeOptional}
                        />

                        <button
                            onClick={() => document.getElementById('file-import')?.click()}
                            className={`${INTERACTIVE.secondary} px-3 py-1.5 rounded-lg text-[11px] font-medium ${BORDER.inner} cursor-pointer flex items-center gap-1.5 transition-colors`}
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

            {/* Content view workspace */}
            <div className="relative flex flex-col flex-1 min-h-0 px-3 pt-3 pb-2">
                <div className={`relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl ${BORDER.outer} ${LAYER.viewportGlass}`}>
                    {targetMods.length > 0 && (
                        <div className={`relative shrink-0 border-b ${DIVIDER.outer} ${LAYER.viewportHeader} px-3 pt-3 pb-0 flex items-start justify-between`}>
                            <div className="inline-flex gap-6 text-xs font-bold select-none -mb-px">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`relative pb-3 flex items-center gap-1.5 transition-all cursor-pointer ${
                                        viewMode === 'cards'
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <LayoutGrid className={`w-3.5 h-3.5 ${viewMode === 'cards' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                                    <span>Mod Cards</span>
                                    {viewMode === 'cards' && (
                                        <span className="absolute bottom-0 -left-2 -right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setViewMode('tree')}
                                    className={`relative pb-3 flex items-center gap-1.5 transition-all cursor-pointer ${
                                        viewMode === 'tree'
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <Layers className={`w-3.5 h-3.5 ${viewMode === 'tree' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                                    <span>Dependency Tree</span>
                                    {viewMode === 'tree' && (
                                        <span className="absolute bottom-0 -left-2 -right-2 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                                    )}
                                </button>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 pb-3">
                                {targetMods.length} Target Mods
                            </span>
                        </div>
                    )}
                    {/* Scrollable body region. Rules:
                          • Content (cards / tree) sizes naturally — NO internal
                            scroll constraints (flex-1/min-h-0 removed from children).
                          • When content overflows, this outer container scrolls
                            (overflow-y-auto).
                          • Download button uses sticky bottom-0 so it floats at
                            the bottom-right when content is tall, or sits directly
                            below content when short.
                        Padding provides symmetric air gap around inner content. */}
                    <div className="relative flex-1 min-h-0 flex flex-col items-start overflow-y-auto p-5 pr-3">
                        {/* Single layout that handles BOTH sizes via max-height cap. */}
                        <div className="w-full flex flex-col">
                            {targetMods.length === 0 ? (
                                <div className="h-full min-h-[200px] text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
                                    <div className={`p-4 rounded-full ${LAYER.pillSurface} ${BORDER.inner} flex items-center justify-center text-indigo-500`}>
                                        <Inbox className="w-8 h-8 stroke-[1.2]" />
                                    </div>
                                    <div className="flex flex-col gap-1 max-w-[280px] text-center select-none">
                                        <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">No target mods added</span>
                                        <span className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">Paste mod URLs or import a text file to inspect target mods, toggle recommended/optional dependencies, and download.</span>
                                    </div>
                                </div>
                            ) : viewMode === 'tree' ? (
                                <>
                                    <div className="w-full">
                                        {renderDependencyTreePanel()}
                                    </div>
                                    <div className="sticky bottom-0 z-20 flex justify-end pt-4 pb-1 pointer-events-none -ml-5 -mr-3 pl-5 pr-3">
                                        <button
                                            onClick={handleStartDownloadAll}
                                            disabled={isBusy}
                                            className="pointer-events-auto py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60"
                                        >
                                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                            <span>{isBusy ? 'Resolving Dependencies...' : `Download All (${targetMods.length} Target Mods)`}</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Cards list — natural flow, no internal scroll.
                                        Outer overflow-y-auto handles scrolling. */}
                                    <div className="w-full flex flex-col gap-4">
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
                                    </div>
                                    <div className="sticky bottom-0 z-20 flex justify-end pt-4 pb-1 pointer-events-none -ml-5 -mr-3 pl-5 pr-3">
                                        <button
                                            onClick={handleStartDownloadAll}
                                            disabled={isBusy}
                                            className="pointer-events-auto py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer select-none disabled:opacity-60"
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
            </div>
        </div>
    );
};
