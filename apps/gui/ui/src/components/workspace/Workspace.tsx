import React, { useState, useEffect, useRef } from 'react';
import { Search, HardDrive, Terminal, Trash2, X } from 'lucide-react';
import { ResolverTab } from './ResolverTab';
import { InstalledTab } from './InstalledTab';
import { useAppContext } from '../../context/AppContext';

export const Workspace: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'resolver' | 'installed'>('resolver');
    const { consoleOpen, setConsoleOpen, logs, clearLogs } = useAppContext();
    const consoleEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll console to bottom on new logs
    useEffect(() => {
        if (consoleOpen && consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, consoleOpen]);

    return (
        <div className="flex-1 flex flex-col min-w-[450px] bg-slate-100 dark:bg-zinc-950 transition-colors relative overflow-hidden">
            <div className="h-14 flex items-center bg-slate-50/60 dark:bg-zinc-900/40 backdrop-blur-sm px-6 shrink-0 transition-colors">
                <div className="flex gap-1 bg-slate-200/60 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800/40 text-[11px] font-semibold w-fit">
                    {/* Dependency Resolver Tab */}
                    <button
                        onClick={() => setActiveTab('resolver')}
                        className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'resolver'
                            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border-slate-200/50 dark:border-zinc-700/60'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                    >
                        <Search className="w-3.5 h-3.5" />
                        <span>Dependency Resolver</span>
                    </button>

                    {/* Installed Mods Tab */}
                    <button
                        onClick={() => setActiveTab('installed')}
                        className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'installed'
                            ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border-slate-200/50 dark:border-zinc-700/60'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                            }`}
                    >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Installed Mods</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'installed'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-300/50 dark:bg-zinc-900 text-slate-500'
                            }`}>
                            3 Updates
                        </span>
                    </button>
                </div>
            </div>

            {/* Content Rendering and Console wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto relative">
                    {activeTab === 'resolver' ? <ResolverTab /> : <InstalledTab />}
                </div>

                {/* Console Logs Docked Split Panel */}
                {consoleOpen && (
                    <div className="h-52 shrink-0 w-full border-t border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden relative z-25 bg-slate-50 dark:bg-zinc-950/40">
                        {/* Console Header */}
                        <div className="h-9 px-6 flex items-center justify-between bg-slate-200/55 dark:bg-zinc-900/60 border-b border-slate-200/60 dark:border-zinc-800/60 select-none shrink-0">
                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-slate-600 dark:text-zinc-400">
                                <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                                <span>System Console Logs</span>
                                <span className="bg-slate-350/50 dark:bg-zinc-800 text-[9px] px-1.5 py-0.2 rounded-full font-mono text-slate-700 dark:text-zinc-350">{logs.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={clearLogs}
                                    className="text-slate-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-1 text-[9px] font-semibold uppercase cursor-pointer"
                                    title="Clear logs"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Clear</span>
                                </button>
                                <button 
                                    onClick={() => setConsoleOpen(false)}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                    title="Close console"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Console Output Terminal */}
                        <div className="flex-1 overflow-y-auto px-6 py-3.5 font-mono text-[10px] leading-relaxed flex flex-col gap-1 select-text bg-slate-100 dark:bg-black text-slate-700 dark:text-zinc-200 border-t border-slate-200/50 dark:border-zinc-900/60">
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
                                    <div key={log.id} className="flex gap-2.5 items-start hover:bg-slate-200/60 dark:hover:bg-zinc-900/30 py-0.5 px-1 rounded transition-colors">
                                        <span className="text-slate-400 dark:text-zinc-500 select-none shrink-0">{log.timestamp}</span>
                                        <span className={`${levelColor} font-bold select-none shrink-0`}>[{levelLabel}]</span>
                                        <span className="flex-1 text-slate-800 dark:text-zinc-200 break-all">{log.message}</span>
                                    </div>
                                );
                            })}
                            <div ref={consoleEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};