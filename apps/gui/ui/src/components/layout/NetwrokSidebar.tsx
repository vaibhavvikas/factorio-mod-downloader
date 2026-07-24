import React from 'react';
import { Download, Inbox, RotateCcw, Trash2, X } from 'lucide-react';
import { useAppContext, type DownloadTask } from '../../context/AppContext';

export const NetworkSidebar: React.FC = () => {
    const { sidebarOpen, toggleSidebar, queue, clearCompleted, retryTask } = useAppContext();

    const activeItems = queue
        .filter((i: DownloadTask) => i.statusType !== 'failed' && i.progress < 100 && i.statusType !== 'completed' && i.statusType !== 'alreadyExists' && i.statusType !== 'updated')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    const failedItems = queue
        .filter((i: DownloadTask) => i.statusType === 'failed')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    const completedItems = queue
        .filter((i: DownloadTask) => i.progress >= 100 || i.statusType === 'completed' || i.statusType === 'alreadyExists' || i.statusType === 'updated')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    return (
        <div className={`absolute right-4 top-2 bottom-4 w-[360px] z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 shadow-2xl flex flex-col shrink-0 transition-all duration-200 overflow-hidden ${sidebarOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
            {/* Header section */}
            <div className="h-8.5 px-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-100/50 dark:bg-zinc-900/40 shrink-0 select-none">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Download Manager</span>
                    <span className="bg-slate-200/70 dark:bg-zinc-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-slate-700 dark:text-zinc-300">{queue.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    {completedItems.length > 0 && (
                        <button 
                            onClick={clearCompleted} 
                            className="text-slate-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                            title="Clear completed transfers"
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                    <button
                        onClick={() => toggleSidebar(false)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        title="Close Download Manager"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Queue Item Cards Categorized */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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
                    <>
                        {/* Group 1: Downloading & Pending */}
                        {activeItems.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 select-none px-1">
                                    <span>Downloading & Pending ({activeItems.length})</span>
                                </div>
                                {activeItems.map(item => {
                                    const remainingSecs = Math.ceil((item.size * (1 - item.progress / 100)) / parseFloat(item.speed));
                                    const downloadedSize = (item.size * (item.progress / 100)).toFixed(1);
                                    return (
                                        <div key={item.id} className="relative pl-4.5 p-3.5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl flex flex-col gap-2.5 shadow-md hover:shadow-lg dark:shadow-indigo-500/5 transition-all duration-200">
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
                                })}
                            </div>
                        )}

                        {/* Group 2: Action Required (Failed) */}
                        {failedItems.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400 select-none px-1">
                                    <span>Failed ({failedItems.length})</span>
                                </div>
                                {failedItems.map(item => {
                                    const is404 = item.errorMessage?.includes('404');
                                    return (
                                        <div key={item.id} className="relative pl-4.5 p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 rounded-xl flex flex-col gap-2 shadow-xs">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 rounded-l-xl" />
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 overflow-hidden">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                                    <span className="truncate">{item.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => retryTask(item.id)}
                                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                                                    title="Retry downloading this mod"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    <span>Retry</span>
                                                </button>
                                            </div>
                                            <div className="flex justify-between text-[9px] font-mono text-rose-600/80 dark:text-rose-400/80 select-none gap-2">
                                                <span>v{item.version}</span>
                                                <span className="font-bold truncate max-w-[200px]" title={item.errorMessage || 'Download Failed'}>
                                                    {is404 ? 'Mod not found on server (recently added?)' : (item.errorMessage || 'Download Failed')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Group 3: Completed / Existing */}
                        {completedItems.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-zinc-400 select-none px-1">
                                    <span>Completed ({completedItems.length})</span>
                                </div>
                                {completedItems.map(item => {
                                    const isExists = item.statusType === 'alreadyExists';
                                    const isUpdated = item.statusType === 'updated';

                                    const badgeLabel = isExists ? 'Already Exists' : isUpdated ? 'Updated' : 'Downloaded';
                                    const badgeColor = isExists
                                        ? 'text-slate-500 dark:text-zinc-400 font-medium'
                                        : isUpdated
                                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                        : 'text-emerald-500 dark:text-emerald-400 font-semibold';
                                    const dotColor = isExists
                                        ? 'bg-slate-400'
                                        : isUpdated
                                        ? 'bg-indigo-500 shadow-indigo-500/50'
                                        : 'bg-emerald-500 shadow-emerald-500/50';

                                    return (
                                        <div key={item.id} className="p-3.5 bg-slate-100/60 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl flex flex-col gap-2.5 shadow-sm transition-all opacity-85">
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 overflow-hidden">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 shadow-sm ${dotColor}`} />
                                                    <span className="truncate font-semibold">{item.name}</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-200/60 dark:bg-zinc-800/60 h-1 rounded-full overflow-hidden shadow-inner">
                                                <div className={`h-full transition-all duration-200 ${isExists ? 'bg-slate-400' : isUpdated ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: '100%' }} />
                                            </div>
                                            <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-zinc-500 select-none">
                                                <span>v{item.version} • {item.size.toFixed(1)} MB</span>
                                                <span className={`text-[9px] ${badgeColor}`}>{badgeLabel}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};