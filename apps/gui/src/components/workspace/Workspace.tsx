import React, { useState, useEffect, useRef } from 'react';
import { Compass, Package, HardDrive, Terminal, Trash2, X } from 'lucide-react';
import { SearchTab } from './explore/SearchTab';
import { ResolverTab } from './mod-queue/ResolverTab';
import { InstalledTab } from './mod-manager/InstalledTab';
import type { TargetModItem } from './mod-queue/ModAccordionCard';
import { useAppContext } from '../../context/AppContext';
import { invoke } from '@tauri-apps/api/core';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE, ANIMATION } from '../../theme/layers';
import { getInitialSelectedDepIds } from './mod-queue/queueAutoSelect';

export const Workspace: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'installed'>('search');
    const [targetMods, setTargetMods] = useState<TargetModItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { consoleOpen, setConsoleOpen, logs, clearLogs, addLog } = useAppContext();
    const consoleEndRef = useRef<HTMLDivElement>(null);
    const addingInFlightRef = useRef(0);

    // Auto-scroll console to bottom on new logs
    useEffect(() => {
        if (consoleOpen && consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, consoleOpen]);

    const targetModsRef = useRef<TargetModItem[]>([]);
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
            const latestVersion = reversedReleases[0]?.version || 'latest';

            const defaultDeps = details.default_dependencies || { required: [], recommended: [], optional: [], incompatible: [] };
            
            const treeNodes: any[] = [];
            const mapDep = (dep: any, type: string) => ({
                id: `dep-${dep.id}-${Math.random()}`,
                name: String(dep.id),
                version: String(dep.version || ''),
                size: 15.0,
                type: type,
            });

            (defaultDeps.required || []).forEach((d: any) => treeNodes.push(mapDep(d, 'required')));
            (defaultDeps.recommended || []).forEach((d: any) => treeNodes.push(mapDep(d, 'recommended')));
            (defaultDeps.optional || []).forEach((d: any) => treeNodes.push(mapDep(d, 'optional')));
            (defaultDeps.incompatible || []).forEach((d: any) => treeNodes.push(mapDep(d, 'incompatible')));

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
            addLog(`Failed to add mod "${trimmed}": ${err?.toString() || 'Unknown error'}`, 'error');
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

    return (
        <div className={`flex-1 flex flex-col w-full h-full min-w-0 min-h-0 ${LAYER.appCanvas} transition-colors relative overflow-hidden`}>
            {/* Primary App Navigation Header Bar */}
            <div className={`h-14 flex items-center justify-between ${LAYER.navBar} border-b ${DIVIDER.outer} px-4 shrink-0 transition-colors select-none`}>
                <nav className="flex items-center gap-2 h-full">
                    {/* Tab 1: Explore */}
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`h-10 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-xl border ${
                            activeTab === 'search' ? LAYER.navTabActive : LAYER.navTabInactive
                        }`}
                    >
                        <Compass className={`w-4 h-4 ${activeTab === 'search' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Explore</span>
                    </button>

                    {/* Tab 2: Mod Queue */}
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`h-10 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-xl border ${
                            activeTab === 'queue' ? LAYER.navTabActive : LAYER.navTabInactive
                        }`}
                    >
                        <Package className={`w-4 h-4 ${activeTab === 'queue' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Mod Queue</span>
                        {targetMods.length > 0 && (
                            <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[9.5px] font-mono font-bold leading-none ${
                                activeTab === 'queue'
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
                        className={`h-10 px-3.5 flex items-center gap-2 text-xs font-bold ${ANIMATION.tabButton} cursor-pointer rounded-xl border ${
                            activeTab === 'installed' ? LAYER.navTabActive : LAYER.navTabInactive
                        }`}
                    >
                        <HardDrive className={`w-4 h-4 ${activeTab === 'installed' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span>Mod Manager</span>
                    </button>
                </nav>
            </div>

            {/* Content Rendering and Console wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    {activeTab === 'search' && (
                        <div key="tab-search" className={`h-full ${ANIMATION.tabPane}`}>
                            <SearchTab 
                                existingModNames={targetMods.map(m => m.name)}
                                onAddModToQueue={handleAddModToQueue}
                            />
                        </div>
                    )}
                    {activeTab === 'queue' && (
                        <div key="tab-queue" className={`h-full overflow-hidden ${ANIMATION.tabPane}`}>
                            <ResolverTab 
                                targetMods={targetMods}
                                setTargetMods={setTargetMods}
                                loading={loading}
                                parseAndAddMods={handleParseAndAddMods}
                            />
                        </div>
                    )}
                    {activeTab === 'installed' && (
                        <div key="tab-installed" className={`h-full ${ANIMATION.tabPane}`}>
                            <InstalledTab />
                        </div>
                    )}
                </div>

                {/* System Console Logs Panel — Bottom Docked Persistent Window pushing content up */}
                {consoleOpen && (
                    <div className={`h-[206px] shrink-0 w-full px-4 pb-3 pt-2 ${LAYER.appCanvas} transition-all duration-200`}>
                        <div className={`h-full ${LAYER.groupPanel} backdrop-blur-md rounded-2xl ${BORDER.outer} shadow-xl flex flex-col overflow-hidden`}>
                            {/* Console Header */}
                            <div className={`h-9 min-h-9 max-h-9 px-3.5 border-b ${DIVIDER.outer} flex items-center justify-between ${LAYER.viewportHeader} shrink-0 select-none`}>
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                                    <Terminal className="w-3.5 h-3.5 text-blue-500" />
                                    <span>System Console Logs</span>
                                    <span className={`${LAYER.pillSurface} ${BORDER.pill} text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-slate-700 dark:text-zinc-300`}>{logs.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={clearLogs}
                                        className={`${TEXT.secondary} hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer ${INTERACTIVE.iconHover}`}
                                        title="Clear logs"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Clear</span>
                                    </button>
                                    <button 
                                        onClick={() => setConsoleOpen(false)}
                                        className={`${TEXT.muted} hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer ${INTERACTIVE.iconHover}`}
                                        title="Close console logs"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Console Output Terminal — standards-based zero-shift
                                symmetric scroll layout (.terminal variant). Balances the 8px stable
                                gutter on the right with 8px extra padding on the left. */}
                            <div className={`scroller-panel terminal flex-1 font-mono text-[11px] leading-relaxed flex flex-col gap-1 select-text ${LAYER.innerRecessed} text-slate-700 dark:text-zinc-200`}>
                                {logs.map(log => {
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
                                        <div key={log.id} className={`flex gap-2.5 items-start py-0.5 px-2 rounded-lg transition-colors border border-transparent shrink-0 hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 hover:border-slate-200/60 dark:hover:border-zinc-700/50`}>
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
