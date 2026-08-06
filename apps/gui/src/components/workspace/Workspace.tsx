import React, { useState, useEffect, useRef } from 'react';
import { Compass, Package, HardDrive, Terminal, Trash2, X, Search as SearchIcon, RefreshCw, FileText, Loader2, FolderOpen, FolderSearch, FolderOutput, Plus } from 'lucide-react';
import { SearchTab } from './explore/SearchTab';
import { ResolverTab } from './mod-queue/ResolverTab';
import { InstalledTab } from './mod-manager/InstalledTab';
import type { TargetModItem } from './mod-queue/ModAccordionCard';
import { useAppContext } from '../../context/AppContext';
import { invoke } from '@tauri-apps/api/core';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE, ANIMATION } from '../../theme/layers';
import { getInitialSelectedDepIds } from './mod-queue/queueAutoSelect';
import { formatUserFriendlyError } from '../../utils/errorUtils';
import { Tooltip } from '../ui/Tooltip';
import { QueueSettingsDropdown } from './mod-queue/QueueSettingsDropdown';
import {
    QUEUE_AUTO_RECOMMENDED_KEY,
    QUEUE_AUTO_OPTIONAL_KEY,
    getQueueAutoIncludeSettings,
} from './mod-queue/queueAutoSelect';

export const Workspace: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'installed'>('search');
    const [targetMods, setTargetMods] = useState<TargetModItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { consoleOpen, setConsoleOpen, logs, clearLogs, addLog, factorioVersion, folderPath, setFolderPath, loadingInstalled, isCheckingUpdates, refreshInstalledMods: loadInstalledMods } = useAppContext();
    const [isClearingLogs, setIsClearingLogs] = useState(false);
    const consoleEndRef = useRef<HTMLDivElement>(null);
    const addingInFlightRef = useRef(0);

    // === Lifted state for SearchTab (Explore) ===
    const [searchQuery, setSearchQuery] = useState('');
    const [searchReloadTrigger, setSearchReloadTrigger] = useState(0);
    const [searchLoading, setSearchLoading] = useState(false);

    // === Lifted state for ResolverTab (Mod Queue) ===
    const [queueInputText, setQueueInputText] = useState('');
    const [queueBusy, setQueueBusy] = useState(false);
    const queueFileInputRef = useRef<HTMLInputElement>(null);
    const [queueAutoIncludeRecommended, setQueueAutoIncludeRecommended] = useState<boolean>(() => {
        return getQueueAutoIncludeSettings().recommended;
    });
    const [queueAutoIncludeOptional, setQueueAutoIncludeOptional] = useState<boolean>(() => {
        return getQueueAutoIncludeSettings().optional;
    });

    // === Lifted state for InstalledTab (Mod Manager) ===
    const isInstalledAnyLoading = loadingInstalled;

    const handleClearLogs = () => {
        setIsClearingLogs(true);
        const visibleCount = Math.min(logs.length, 12);
        const totalTimeout = visibleCount * 45 + 220;
        setTimeout(() => {
            clearLogs();
            setIsClearingLogs(false);
        }, totalTimeout);
    };

    // Auto-scroll console to bottom on new logs
    useEffect(() => {
        if (consoleOpen && consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, consoleOpen]);

    const targetModsRef = useRef<TargetModItem[]>(targetMods);
    useEffect(() => {
        targetModsRef.current = targetMods;
    }, [targetMods]);

    // Shared mod adder triggered from SearchTab or input bar
    const handleAddModToQueue = async (modName: string, goToQueue: boolean = false) => {
        const trimmed = modName.trim();
        if (!trimmed) return;

        if (targetModsRef.current.some(m => m.name === trimmed)) {
            addLog(`Mod "${trimmed}" is already in your Mod Queue`, 'info');
            if (goToQueue) setActiveTab('queue');
            return;
        }

        addingInFlightRef.current += 1;
        setLoading(true);

        try {
            const details = await invoke<any>('fetch_mod_details', { modId: trimmed });
            const reversedReleases = details.releases.slice().reverse();

            const compatibleReleases = reversedReleases.filter((r: any) => {
                if (!factorioVersion || factorioVersion === 'all' || factorioVersion === 'any') return true;
                if (!r.factorio_version) return true;
                const cleanRel = r.factorio_version.trim();
                const cleanTarget = factorioVersion.trim();
                return cleanRel === cleanTarget || cleanRel.startsWith(cleanTarget) || cleanTarget.startsWith(cleanRel);
            });

            const bestRelease = compatibleReleases.length > 0 ? compatibleReleases[0] : reversedReleases[0];
            const latestVersion = bestRelease?.version || 'latest';

            const releaseDeps = (bestRelease && bestRelease.dependencies)
                ? bestRelease.dependencies
                : (details.default_dependencies || { required: [], recommended: [], optional: [], incompatible: [] });

            const treeNodes: any[] = [];
            const mapDep = (dep: any, type: string) => ({
                id: `dep-${dep.id}-${Math.random()}`,
                name: String(dep.id),
                ineq: dep.ineq,
                version: String(dep.version || ''),
                size: 15.0,
                type: type,
            });

            (releaseDeps.required || []).forEach((d: any) => treeNodes.push(mapDep(d, 'required')));
            (releaseDeps.recommended || []).forEach((d: any) => treeNodes.push(mapDep(d, 'recommended')));
            (releaseDeps.optional || []).forEach((d: any) => treeNodes.push(mapDep(d, 'optional')));
            (releaseDeps.incompatible || []).forEach((d: any) => treeNodes.push(mapDep(d, 'incompatible')));

            const initialSelectedIds = getInitialSelectedDepIds(treeNodes);

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
                availableReleases: reversedReleases.map((r: any) => ({
                    version: r.version,
                    factorio_version: r.factorio_version,
                    released_at: r.released_at,
                    dependencies: r.dependencies,
                })),
                selectedDepIds: initialSelectedIds,
                dependencies: treeNodes
            };

            setTargetMods(prev => {
                if (prev.some(m => m.name === details.name)) return prev;
                return [...prev, newCard];
            });

            addLog(`Added "${details.title || details.name}" to Mod Queue`, 'success');

            if (goToQueue) {
                setActiveTab('queue');
            }
        } catch (err: any) {
            addLog(`Failed to add mod "${trimmed}": ${formatUserFriendlyError(err, trimmed)}`, 'error');
        } finally {
            addingInFlightRef.current = Math.max(0, addingInFlightRef.current - 1);
            if (addingInFlightRef.current === 0) {
                setLoading(false);
            }
        }
    };

    const handleParseAndAddMods = async (text: string) => {
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
            } catch {
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

        addingInFlightRef.current += 1;
        setLoading(true);

        try {
            for (const modId of newModNames) {
                await handleAddModToQueue(modId, false);
            }
        } finally {
            addingInFlightRef.current = Math.max(0, addingInFlightRef.current - 1);
            if (addingInFlightRef.current === 0) {
                setLoading(false);
            }
        }
    };

    // Handlers for queue auto-include settings (lifted from ResolverTab)
    const handleToggleAutoIncludeRecommended = (enabled: boolean) => {
        setQueueAutoIncludeRecommended(enabled);
        localStorage.setItem(QUEUE_AUTO_RECOMMENDED_KEY, String(enabled));
    };
    const handleToggleAutoIncludeOptional = (enabled: boolean) => {
        setQueueAutoIncludeOptional(enabled);
        localStorage.setItem(QUEUE_AUTO_OPTIONAL_KEY, String(enabled));
    };

    // Handler for queue "Add Mods" click
    const handleQueueAddClick = () => {
        if (!queueInputText.trim()) return;
        handleParseAndAddMods(queueInputText);
        setQueueInputText('');
    };

    // Handler for queue file import
    const handleQueueFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            handleParseAndAddMods(text);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Handlers for Installed tab browse
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

    return (
        <div className={`flex-1 flex flex-col w-full h-full min-w-0 min-h-0 ${LAYER.appCanvas} transition-colors relative overflow-hidden`}>
            {/* Primary App Navigation Header Bar */}
            <div className={`h-14 flex items-center justify-between ${LAYER.navBar} border-b ${DIVIDER.outer} px-4 shrink-0 transition-colors select-none relative z-30 gap-8`}>
                <nav className="flex items-center gap-2 h-full shrink-0">
                    {/* Tab 1: Explore */}
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`h-9 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-md border ${activeTab === 'search' ? LAYER.navTabActive : LAYER.navTabInactive
                            }`}
                    >
                        <Compass className={`w-4 h-4 ${activeTab === 'search' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Explore</span>
                    </button>

                    {/* Tab 2: Mod Queue */}
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`h-9 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-md border ${activeTab === 'queue' ? LAYER.navTabActive : LAYER.navTabInactive
                            }`}
                    >
                        <Package className={`w-4 h-4 ${activeTab === 'queue' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Mod Queue</span>
                        {targetMods.length > 0 && (
                            <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1.5 text-[9.5px] font-mono font-bold leading-none ${activeTab === 'queue'
                                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                                    : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                                }`}>
                                {targetMods.length}
                            </span>
                        )}
                    </button>

                    {/* Tab 3: Mod Manager */}
                    <button
                        onClick={() => setActiveTab('installed')}
                        className={`h-9 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-md border ${activeTab === 'installed' ? LAYER.navTabActive : LAYER.navTabInactive
                            }`}
                    >
                        <HardDrive className={`w-4 h-4 ${activeTab === 'installed' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Mod Manager</span>
                    </button>
                </nav>

                {/* Contextual Toolbar — changes based on active tab */}
                <div className="flex-1 min-w-0 flex items-center justify-end h-full">
                    {/* Explore tab: Search bar */}
                    {activeTab === 'search' && (
                        <div className="flex items-center gap-2 w-full max-w-3xl">
                            <div className={`flex flex-1 h-9 ${LAYER.toolbar} ${BORDER.toolbar} rounded-md pl-3 pr-2 py-1 items-center gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all shadow-xs`}>
                                <SearchIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search Factorio mods by title, author, or keyword (e.g. Krastorio, Space Exploration, Bob...)"
                                    className="bg-transparent border-none text-xs text-slate-800 dark:text-zinc-100 focus:outline-none w-full font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                                />
                                {searchQuery.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSearchReloadTrigger(prev => prev + 1)}
                                disabled={searchLoading}
                                aria-label="Reload mod results"
                                className={`h-9 px-3 flex items-center justify-center gap-1.5 rounded-md ${INTERACTIVE.secondary} ${BORDER.inner} shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-50 text-xs font-medium`}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${searchLoading ? 'animate-spin text-blue-500' : 'text-slate-500 dark:text-zinc-400'}`} />
                                <span>Reload</span>
                            </button>
                        </div>
                    )}

                    {/* Mod Queue tab: URL/name input bar */}
                    {activeTab === 'queue' && (
                        <div className="flex items-center gap-2 w-full max-w-3xl">
                            <div className={`flex flex-1 h-9 ${LAYER.toolbar} ${BORDER.toolbar} rounded-md pl-3 pr-2 py-1 items-center gap-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all shadow-xs`}>
                                <SearchIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    value={queueInputText}
                                    onChange={(e) => setQueueInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleQueueAddClick();
                                    }}
                                    placeholder="Paste Factorio Mod URL or type mod name..."
                                    className="bg-transparent border-none text-xs text-slate-800 dark:text-zinc-100 focus:outline-none w-full font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                                />
                                {queueInputText.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setQueueInputText('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                                        aria-label="Clear input"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <QueueSettingsDropdown
                                    autoIncludeRecommended={queueAutoIncludeRecommended}
                                    autoIncludeOptional={queueAutoIncludeOptional}
                                    onToggleRecommended={handleToggleAutoIncludeRecommended}
                                    onToggleOptional={handleToggleAutoIncludeOptional}
                                />
                                <button
                                    onClick={() => queueFileInputRef.current?.click()}
                                    className={`h-9 ${INTERACTIVE.secondary} px-2.5 rounded-md text-[11px] font-medium ${BORDER.inner} cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs`}
                                >
                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Import</span>
                                </button>
                                <button
                                    onClick={handleQueueAddClick}
                                    disabled={queueBusy || loading}
                                    className={`h-9 ${INTERACTIVE.secondary} px-3 rounded-md text-xs font-medium ${BORDER.inner} cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 shrink-0`}
                                >
                                    {(queueBusy || loading) ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Plus className="w-3.5 h-3.5 text-blue-500" />}
                                    <span>{(queueBusy || loading) ? 'Fetching...' : 'Add'}</span>
                                </button>
                            </div>
                            <input
                                type="file"
                                ref={queueFileInputRef}
                                accept=".txt"
                                style={{ display: 'none' }}
                                onChange={handleQueueFileChange}
                            />
                        </div>
                    )}

                    {/* Mod Manager tab: Folder path bar */}
                    {activeTab === 'installed' && (
                        <div className="flex items-center gap-2 w-full max-w-3xl">
                            <div className={`flex flex-1 h-9 ${LAYER.toolbar} ${BORDER.toolbar} rounded-md pl-3 pr-3 py-1 items-center gap-2 text-xs shadow-xs min-w-0`}>
                                <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="font-semibold text-slate-400 dark:text-zinc-500 shrink-0">Mods Path:</span>
                                <Tooltip content={folderPath}>
                                    <span className="font-mono text-[11px] text-slate-900 dark:text-zinc-100 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
                                        {folderPath || 'Detecting folder...'}
                                    </span>
                                </Tooltip>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Tooltip content="Browse / Change Folder">
                                    <button
                                        onClick={(e) => {
                                            e.currentTarget.blur();
                                            handleBrowseFolder();
                                        }}
                                        className={`h-9 ${INTERACTIVE.secondary} px-2.5 rounded-md ${BORDER.inner} cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs text-xs font-medium`}
                                    >
                                        <FolderSearch className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Browse</span>
                                    </button>
                                </Tooltip>
                                <Tooltip content="Open folder in File Explorer">
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
                                        className={`h-9 ${INTERACTIVE.secondary} px-2.5 rounded-md ${BORDER.inner} cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs text-xs font-medium`}
                                    >
                                        <FolderOutput className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Open Folder</span>
                                    </button>
                                </Tooltip>
                                <Tooltip content={isCheckingUpdates ? 'Checking for online mod updates...' : isInstalledAnyLoading ? 'Scanning local mods folder...' : 'Sync & check for mod updates'}>
                                    <button
                                        onClick={(e) => {
                                            e.currentTarget.blur();
                                            loadInstalledMods(folderPath);
                                        }}
                                        disabled={isInstalledAnyLoading}
                                        className={`h-9 ${INTERACTIVE.secondary} px-2.5 rounded-md ${BORDER.inner} cursor-pointer transition-colors disabled:opacity-50 select-none flex items-center justify-center gap-1.5 shadow-2xs text-xs font-medium`}
                                        aria-label="Sync & Check Updates"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isInstalledAnyLoading ? 'animate-spin' : ''}`} />
                                        <span>Sync</span>
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Rendering and Console wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    <div className={`h-full ${ANIMATION.tabPane} ${activeTab === 'search' ? 'block' : 'hidden'}`}>
                        <SearchTab
                            existingModNames={targetMods.map(m => m.name)}
                            onAddModToQueue={handleAddModToQueue}
                            query={searchQuery}
                            reloadTrigger={searchReloadTrigger}
                            onSearchLoadingChange={setSearchLoading}
                        />
                    </div>
                    <div className={`h-full overflow-hidden ${ANIMATION.tabPane} ${activeTab === 'queue' ? 'block' : 'hidden'}`}>
                        <ResolverTab
                            targetMods={targetMods}
                            setTargetMods={setTargetMods}
                            loading={loading}
                            autoIncludeRecommended={queueAutoIncludeRecommended}
                            autoIncludeOptional={queueAutoIncludeOptional}
                            onBusyChange={setQueueBusy}
                        />
                    </div>
                    <div className={`h-full ${ANIMATION.tabPane} ${activeTab === 'installed' ? 'block' : 'hidden'}`}>
                        <InstalledTab />
                    </div>
                </div>

                {/* System Console Logs Panel — Bottom Docked Persistent Window pushing content up */}
                {consoleOpen && (
                    <div className={`h-[206px] shrink-0 w-full px-4 pb-3 pt-2 ${LAYER.appCanvas} transition-all duration-200`}>
                        <div className={`h-full ${LAYER.groupPanel} backdrop-blur-md rounded-md ${BORDER.outer} shadow-xl flex flex-col overflow-hidden`}>
                            {/* Console Header */}
                            <div className={`h-9 min-h-9 max-h-9 px-3.5 border-b ${DIVIDER.outer} flex items-center justify-between ${LAYER.viewportHeader} shrink-0 select-none`}>
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                                    <Terminal className="w-3.5 h-3.5 text-blue-500" />
                                    <span>System Console Logs</span>
                                    <span className={`${LAYER.pillSurface} ${BORDER.pill} text-[10px] px-2 py-0.5 rounded-md font-mono font-bold text-slate-700 dark:text-zinc-300`}>{logs.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleClearLogs}
                                        aria-label="Clear console logs"
                                        className={`${TEXT.secondary} hover:text-slate-900 dark:hover:text-zinc-100 p-1 rounded transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer ${INTERACTIVE.iconHover}`}
                                    >
                                        <Trash2 className="w-3 h-3 text-slate-400 dark:text-zinc-400" />
                                        <span>Clear</span>
                                    </button>
                                    <button
                                        onClick={() => setConsoleOpen(false)}
                                        aria-label="Close console logs"
                                        className={`${TEXT.muted} hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer ${INTERACTIVE.iconHover}`}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Console Output Terminal — standards-based zero-shift
                                symmetric scroll layout (.terminal variant). Balances the 8px stable
                                gutter on the right with 8px extra padding on the left. */}
                            <div className={`scroller-panel terminal flex-1 font-mono text-[11px] leading-relaxed flex flex-col gap-1 select-text ${LAYER.innerRecessed} text-slate-700 dark:text-zinc-200`}>
                                {logs.map((log, index) => {
                                    const reverseIndex = logs.length - 1 - index;
                                    const staggerIndex = Math.min(reverseIndex, 12);
                                    const animationDelay = isClearingLogs ? `${staggerIndex * 45}ms` : undefined;

                                    const levelColor = {
                                        info: 'text-blue-600 dark:text-blue-400',
                                        warn: 'text-amber-600 dark:text-amber-400',
                                        success: 'text-emerald-600 dark:text-emerald-400',
                                        error: 'text-rose-600 dark:text-rose-400'
                                    }[log.level];

                                    const levelLabel = {
                                        info: 'info',
                                        warn: 'warn',
                                        success: 'okay',
                                        error: 'fail'
                                    }[log.level];

                                    return (
                                        <div
                                            key={log.id}
                                            style={animationDelay ? { animationDelay } : undefined}
                                            className={`flex gap-2.5 items-start py-0.5 px-2 rounded-md transition-all border border-transparent shrink-0 hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 hover:border-slate-200/60 dark:hover:border-zinc-700/50 ${isClearingLogs ? 'item-dismissing' : ''}`}
                                        >
                                            <span className={`${TEXT.muted} select-none shrink-0 font-medium`}>{log.timestamp}</span>
                                            <span className={`${levelColor} font-bold select-none shrink-0 uppercase text-[10px]`}>[{levelLabel}]</span>
                                            <span className="break-all font-medium">{log.message}</span>
                                        </div>
                                    );
                                })}
                                <div ref={consoleEndRef} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
