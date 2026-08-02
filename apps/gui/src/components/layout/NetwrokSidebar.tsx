import React from 'react';
import { Download, Inbox, RotateCcw, Trash2, X, CheckCircle2, Ban } from 'lucide-react';
import { useAppContext, type DownloadTask } from '../../context/AppContext';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE } from '../../theme/layers';
import { Tooltip } from '../ui/Tooltip';

export const NetworkSidebar: React.FC = () => {
    const { sidebarOpen, toggleSidebar, queue, clearCompleted, retryTask, cancelTask, cancelAllTasks } = useAppContext();
    const [isClearingCompleted, setIsClearingCompleted] = React.useState(false);

    const handleClearCompleted = () => {
        setIsClearingCompleted(true);
        const visibleCount = Math.min(completedItems.length, 12);
        const totalTimeout = visibleCount * 45 + 220;
        setTimeout(() => {
            clearCompleted();
            setIsClearingCompleted(false);
        }, totalTimeout);
    };

    const activeItems = queue
        .filter((i: DownloadTask) => i.statusType !== 'failed' && i.progress < 100 && i.statusType !== 'completed' && i.statusType !== 'alreadyExists' && i.statusType !== 'updated' && i.statusType !== 'downgraded')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    const failedItems = queue
        .filter((i: DownloadTask) => i.statusType === 'failed')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    const completedItems = queue
        .filter((i: DownloadTask) => i.progress >= 100 || i.statusType === 'completed' || i.statusType === 'alreadyExists' || i.statusType === 'updated' || i.statusType === 'downgraded')
        .sort((a: DownloadTask, b: DownloadTask) => a.name.localeCompare(b.name));

    return (
        <div
            style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(calc(100% + 2rem))' }}
            className={`absolute right-4 top-2 bottom-4 w-[380px] z-40 ${LAYER.groupPanel} backdrop-blur-md rounded-2xl ${BORDER.outer} flex flex-col shrink-0 transition-all duration-500 ease-in-out overflow-hidden ${sidebarOpen ? 'opacity-100 shadow-2xl pointer-events-auto' : 'opacity-0 shadow-none pointer-events-none'}`}
        >
            {/* Header section */}
            <div className={`h-9 min-h-9 max-h-9 px-3.5 border-b ${DIVIDER.outer} flex items-center justify-between ${LAYER.viewportHeader} shrink-0 select-none`}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    <span>Download Manager</span>
                    <span className={`${LAYER.pillSurface} ${BORDER.pill} text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-slate-700 dark:text-zinc-300`}>{queue.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    {activeItems.length > 0 && (
                        <Tooltip content="Cancel all active downloads">
                            <button
                                onClick={cancelAllTasks}
                                aria-label="Cancel all active downloads"
                                className={`${TEXT.secondary} hover:text-slate-900 dark:hover:text-zinc-100 p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${INTERACTIVE.iconHover}`}
                            >
                                <Ban className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                            </button>
                        </Tooltip>
                    )}
                    {completedItems.length > 0 && (
                        <Tooltip content="Clear completed transfers">
                            <button
                                onClick={handleClearCompleted}
                                aria-label="Clear completed transfers"
                                className={`${TEXT.secondary} hover:text-slate-900 dark:hover:text-zinc-100 p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${INTERACTIVE.iconHover}`}
                            >
                                <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip content="Close Download Manager">
                        <button
                            onClick={() => toggleSidebar(false)}
                            aria-label="Close Download Manager"
                            className={`${TEXT.muted} hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer ${INTERACTIVE.iconHover}`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className={`scroller-panel card flex-1 flex flex-col gap-4 ${LAYER.innerRecessed}`}>
                {queue.length === 0 ? (
                    <div className="text-center py-20 px-4 text-slate-400 dark:text-zinc-600 text-xs flex flex-col items-center justify-center gap-3 h-full">
                        <div className={`p-4 rounded-full ${LAYER.pillSurface} ${BORDER.inner} shadow-inner flex items-center justify-center text-blue-500 animate-pulse`}>
                            <Inbox className="w-8 h-8 stroke-[1.2]" />
                        </div>
                        <div className="flex flex-col gap-1 max-w-[200px] text-center select-none">
                            <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs">Transfer queue empty</span>
                            <span className={`text-[11px] leading-relaxed ${TEXT.secondary}`}>Add mods in the Dependency Resolver and click download to populate the transfer queue.</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Group 1: Downloading & Pending */}
                        {activeItems.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 select-none px-1">
                                    <span>Downloading & Pending ({activeItems.length})</span>
                                </div>
                                        {activeItems.map(item => {
                                    const isPending = item.statusType === 'pending';
                                    const remainingSecs = Math.ceil((item.size * (1 - item.progress / 100)) / parseFloat(item.speed));
                                    const downloadedSize = (item.size * (item.progress / 100)).toFixed(1);
                                    return (
                                        <div key={item.id} className={`relative pl-4.5 p-3.5 ${LAYER.contentCard} ${BORDER.card} rounded-xl flex flex-col gap-2.5 shadow-md hover:shadow-lg dark:shadow-blue-500/5 transition-all duration-300 animate-fade-in`}>
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isPending ? 'bg-amber-400 dark:bg-amber-500' : 'bg-blue-500'}`} />
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                                                    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden="true">
                                                        {isPending ? (
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400 ring-1 ring-amber-400/20"></span>
                                                        ) : (
                                                            <>
                                                                <span className="animate-ping-soft absolute inline-flex h-full w-full rounded-full bg-blue-400/80"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500 ring-1 ring-blue-500/20"></span>
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="truncate min-w-0">{item.name}</span>
                                                    {isPending && (
                                                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                            Waiting
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                     {isPending ? (
                                                         <>
                                                             <span className="text-[10px] font-bold font-mono text-amber-600 dark:text-amber-400">Queued</span>
                                                             <button
                                                                 onClick={() => cancelTask(item.id)}
                                                                 className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                                                                 title="Cancel queued download"
                                                                 aria-label={`Cancel queued download for ${item.name}`}
                                                             >
                                                                 <X className="w-3 h-3" />
                                                             </button>
                                                         </>
                                                     ) : (
                                                         <>
                                                             <span className="text-[10px] font-bold font-mono text-blue-600 dark:text-blue-400">
                                                                 {Math.floor(item.progress)}%
                                                             </span>
                                                             <button
                                                                 onClick={() => cancelTask(item.id)}
                                                                 className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                                                                 title="Cancel download"
                                                                 aria-label={`Cancel download for ${item.name}`}
                                                             >
                                                                 <X className="w-3 h-3" />
                                                             </button>
                                                         </>
                                                     )}
                                                </div>
                                            </div>
                                            {!isPending && (
                                                <div className={`w-full ${LAYER.innerRecessed} h-1.5 rounded-full overflow-hidden shadow-inner`}>
                                                    <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-shimmer h-full transition-all duration-200" style={{ width: `${item.progress}%` }} />
                                                </div>
                                            )}
                                            <div className={`flex justify-between text-[9px] font-mono ${TEXT.muted} select-none`}>
                                                {isPending ? (
                                                    <span>Waiting for download slot</span>
                                                ) : (
                                                    <>
                                                        <span>v{item.version} • {item.speed} MB/s • {remainingSecs}s left</span>
                                                        <span>{downloadedSize} / {item.size.toFixed(1)} MB</span>
                                                    </>
                                                )}
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
                                        <div key={item.id} className="relative pl-4.5 p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-xl flex flex-col gap-2 shadow-xs transition-all duration-300 animate-fade-in">
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
                                {completedItems.map((item, index) => {
                                    const isExists = item.statusType === 'alreadyExists';
                                    const isUpdated = item.statusType === 'updated';
                                    const isDowngraded = item.statusType === 'downgraded';

                                    const reverseIndex = completedItems.length - 1 - index;
                                    const staggerIndex = Math.min(reverseIndex, 12);
                                    const animationDelay = isClearingCompleted ? `${staggerIndex * 45}ms` : undefined;

                                    const badgeLabel = isExists ? 'Already Exists' : isDowngraded ? 'Downgraded' : isUpdated ? 'Updated' : 'Downloaded';
                                    const badgeColor = isExists
                                        ? 'text-slate-500 dark:text-zinc-400 font-medium'
                                        : isDowngraded
                                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                                            : isUpdated
                                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                                : 'text-emerald-500 dark:text-emerald-400 font-semibold';
                                    const dotColor = isExists
                                        ? 'bg-slate-400'
                                        : isDowngraded
                                            ? 'bg-amber-500 shadow-amber-500/50'
                                            : isUpdated
                                                ? 'bg-blue-500 shadow-blue-500/50'
                                                : 'bg-emerald-500 shadow-emerald-500/50';

                                    return (
                                        <div
                                            key={item.id}
                                            style={animationDelay ? { animationDelay } : undefined}
                                            className={`p-3.5 ${LAYER.innerInset} ${BORDER.cardSoft} rounded-xl flex flex-col gap-2.5 shadow-sm transition-all duration-300 ${isClearingCompleted ? 'item-dismissing' : 'animate-fade-in'} ${isDowngraded ? 'border-amber-500/30 dark:border-amber-500/20' : isUpdated ? 'border-blue-500/30 dark:border-blue-500/20' : !isExists ? 'border-emerald-500/30 dark:border-emerald-500/20' : ''}`}
                                        >
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2 overflow-hidden">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 shadow-sm ${dotColor}`} />
                                                    <span className="truncate font-semibold">{item.name}</span>
                                                </div>
                                                {!isExists && (
                                                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 animate-fade-in ${isDowngraded ? 'text-amber-500' : 'text-emerald-500'}`} />
                                                )}
                                            </div>
                                            <div className={`w-full ${LAYER.innerRecessed} h-1 rounded-full overflow-hidden shadow-inner`}>
                                                <div className={`h-full transition-all duration-200 ${isExists ? 'bg-slate-400' : isDowngraded ? 'bg-amber-500' : isUpdated ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: '100%' }} />
                                            </div>
                                            <div className={`flex justify-between text-[9px] font-mono ${TEXT.muted} select-none`}>
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