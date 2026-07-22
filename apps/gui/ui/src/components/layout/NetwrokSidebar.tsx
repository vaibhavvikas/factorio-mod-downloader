import React from 'react';
import { Download, Inbox, Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export const NetworkSidebar: React.FC = () => {
    const { sidebarOpen, queue, clearCompleted } = useAppContext();



    return (
        <div className={`absolute right-4 top-2 bottom-4 w-[360px] z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 shadow-2xl flex flex-col shrink-0 transition-all duration-200 overflow-hidden ${sidebarOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
            {/* Header section */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-100/50 dark:bg-zinc-900/40 shrink-0 select-none">
                <div className="flex items-center gap-2 font-bold text-xs tracking-wider uppercase text-slate-700 dark:text-zinc-300">
                    <Download className="w-4 h-4 text-indigo-500" /> <span>Download Manager</span>
                </div>
                <div className="flex items-center gap-2">
                    {queue.some(q => q.progress >= 100) && (
                        <button 
                            onClick={clearCompleted} 
                            className="text-slate-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-1 text-[9px] font-bold uppercase cursor-pointer"
                            title="Clear completed transfers"
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Queue Item Cards */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {queue.length === 0 ? (
                    <div className="text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3 h-full">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 shadow-inner flex items-center justify-center text-indigo-500 animate-pulse">
                            <Inbox className="w-8 h-8 stroke-[1.2]" />
                        </div>
                        <div className="flex flex-col gap-1 max-w-[200px] text-center select-none">
                            <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">Transfer queue empty</span>
                            <span className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">Add mods in the Dependency Resolver and click download to populate the transfer queue.</span>
                        </div>
                    </div>
                ) : (
                    [...queue].reverse().map(item => {
                        const isDone = item.progress >= 100;
                        const remainingSecs = Math.ceil((item.size * (1 - item.progress / 100)) / parseFloat(item.speed));
                        const downloadedSize = (item.size * (item.progress / 100)).toFixed(1);
                        
                        if (isDone) {
                            return (
                                <div key={item.id} className="p-3.5 bg-slate-100/60 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl flex flex-col gap-2.5 shadow-sm transition-all opacity-85">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 overflow-hidden">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-sm shadow-emerald-500/50" />
                                            <span className="truncate font-semibold">{item.name}</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200/60 dark:bg-zinc-800/60 h-1 rounded-full overflow-hidden shadow-inner">
                                        <div className="bg-emerald-500 h-full transition-all duration-200" style={{ width: '100%' }} />
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-zinc-500 select-none">
                                        <span>v{item.version} • {item.size.toFixed(1)} MB</span>
                                        <span className="text-emerald-500 dark:text-emerald-400 font-semibold text-[9px]">Downloaded</span>
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div key={item.id} className="relative pl-4.5 p-3.5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl flex flex-col gap-2.5 shadow-md hover:shadow-lg dark:shadow-indigo-500/5 transition-all duration-200">
                                    {/* Active Left Indicator Line */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl" />
                                    
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 overflow-hidden">
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                            </span>
                                            <span className="truncate">{item.name}</span>
                                        </div>
                                        <span className="text-[10px] font-bold font-mono shrink-0 text-indigo-600 dark:text-indigo-400">
                                            {Math.floor(item.progress)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-zinc-800/60 h-1.5 rounded-full overflow-hidden shadow-inner">
                                        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer h-full transition-all duration-200" style={{ width: `${item.progress}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-zinc-500 select-none">
                                        <span>v{item.version} • {item.speed} MB/s • {remainingSecs}s left</span>
                                        <span>{downloadedSize} / {item.size.toFixed(1)} MB</span>
                                    </div>
                                </div>
                            );
                        }
                    })
                )}
            </div>
        </div>
    );
};