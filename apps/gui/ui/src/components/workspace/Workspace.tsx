import React, { useState, useEffect, useRef } from 'react';
import { Compass, Package, HardDrive, Terminal, Trash2, X } from 'lucide-react';
import { SearchTab } from './SearchTab';
import { ResolverTab } from './ResolverTab';
import { InstalledTab } from './InstalledTab';
import type { TargetModItem } from './ModAccordionCard';
import { useAppContext } from '../../context/AppContext';
import { invoke } from '@tauri-apps/api/core';

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

    // Shared mod adder triggered from SearchTab or input bar
    const handleAddModToQueue = async (modName: string, goToQueue: boolean = false) => {
        const trimmed = modName.trim();
        if (!trimmed) return;

        if (targetMods.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
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

            const initialSelectedIds = treeNodes
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

    return (
        <div className="flex-1 flex flex-col min-w-[450px] bg-slate-100 dark:bg-zinc-950 transition-colors relative overflow-hidden">
            <div className="h-14 flex items-center bg-slate-50/60 dark:bg-zinc-900/40 backdrop-blur-sm px-6 shrink-0 transition-colors">
                <div className="flex gap-1 bg-slate-200/60 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800/40 text-xs font-bold w-fit">
                    {/* Tab 1: Explore (Search & Discovery) */}
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-4 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'search'
                            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border-slate-200/50 dark:border-zinc-700/60'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                    >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Explore</span>
                    </button>

                    {/* Tab 2: Mod Queue (Dependency Resolver & Download Queue) */}
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`px-4 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'queue'
                            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border-slate-200/50 dark:border-zinc-700/60'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                    >
                        <Package className="w-3.5 h-3.5" />
                        <span>Mod Queue</span>
                        {targetMods.length > 0 && (
                            <span className={`inline-flex h-4 min-w-4 self-center items-center justify-center rounded-full px-1.5 text-[9px] font-mono font-bold leading-none ${activeTab === 'queue'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-300 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                }`}>
                                {targetMods.length}
                            </span>
                        )}
                    </button>

                    {/* Tab 3: Installed Mods */}
                    <button
                        onClick={() => setActiveTab('installed')}
                        className={`px-4 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'installed'
                            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border-slate-200/50 dark:border-zinc-700/60'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                    >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Mod Manager</span>
                    </button>
                </div>
            </div>

            {/* Content Rendering and Console wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    <div className={activeTab === 'search' ? 'h-full' : 'hidden'}>
                        <SearchTab 
                            existingModNames={targetMods.map(m => m.name)}
                            onAddModToQueue={handleAddModToQueue}
                        />
                    </div>
                    <div className={activeTab === 'queue' ? 'h-full overflow-y-auto' : 'hidden'}>
                        <ResolverTab 
                            targetMods={targetMods}
                            setTargetMods={setTargetMods}
                            loading={loading}
                        />
                    </div>
                    <div className={activeTab === 'installed' ? 'h-full' : 'hidden'}>
                        <InstalledTab />
                    </div>
                </div>

                {/* System Console Logs Panel — Bottom Docked Persistent Window pushing content up */}
                {consoleOpen && (
                    <div className="h-[206px] shrink-0 w-full px-6 pb-3 pt-2 bg-slate-100 dark:bg-zinc-950 transition-all duration-200">
                        <div className="h-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 shadow-xl flex flex-col overflow-hidden">
                            {/* Console Header */}
                            <div className="h-8.5 px-3.5 flex items-center justify-between bg-slate-100/50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 shrink-0 select-none">
                                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                                    <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>System Console Logs</span>
                                    <span className="bg-slate-200/70 dark:bg-zinc-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-slate-700 dark:text-zinc-300">{logs.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={clearLogs}
                                        className="text-slate-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                        title="Clear logs"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Clear</span>
                                    </button>
                                    <button 
                                        onClick={() => setConsoleOpen(false)}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                        title="Close console logs"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Console Output Terminal — Max 5 Log Lines at a time with Scrollbar */}
                            <div className="flex-1 overflow-y-auto p-2.5 px-3 font-mono text-[11px] leading-relaxed flex flex-col gap-1 select-text bg-slate-50 dark:bg-zinc-950/80 text-slate-700 dark:text-zinc-200">
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
                                        <div key={log.id} className="flex gap-2.5 items-start hover:bg-slate-200/50 dark:hover:bg-zinc-900/50 py-0.5 px-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 shrink-0">
                                            <span className="text-slate-400 dark:text-zinc-500 select-none shrink-0 font-medium">{log.timestamp}</span>
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
