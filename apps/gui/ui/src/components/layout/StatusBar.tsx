import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getVersion } from '@tauri-apps/api/app';
import { DIVIDER, TEXT } from '../../theme/layers';

export const StatusBar: React.FC = () => {
    const { queue, logs, consoleOpen, setConsoleOpen, isDownloading, totalSpeed } = useAppContext();
    const lastLog = logs[logs.length - 1];
    const [appVersion, setAppVersion] = useState('');

    useEffect(() => {
        getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion(''));
    }, []);

    const remainingItems = queue.filter(q => q.progress < 100).length;
    const completedItems = queue.length - remainingItems;

    return (
        <div className={`h-8 bg-slate-50 dark:bg-zinc-950 border-t ${DIVIDER.outer} flex items-center justify-between px-3 shrink-0 text-[11px] font-medium text-slate-600 dark:text-zinc-400 transition-colors`}>
            <div className="flex items-center gap-4 overflow-hidden flex-1 mr-4">
                <button
                    onClick={() => setConsoleOpen(!consoleOpen)}
                    className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-left truncate flex-1"
                    title="Click to toggle system logs panel"
                >
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                    </span>
                    <Terminal className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className={`font-mono text-[10px] truncate ${TEXT.secondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}>
                        {lastLog ? lastLog.message : 'System active.'}
                    </span>
                </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">

                {queue.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 select-none">
                        {isDownloading ? (
                            <>
                                <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                <span>Syncing: <strong className="text-slate-800 dark:text-zinc-200 font-mono font-bold">{completedItems}/{queue.length}</strong> ({totalSpeed.toFixed(1)} MB/s)</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">All Synced</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[8.5px]">Ready</span>
                    </div>
                )}

                {/* Dynamic app version from tauri.conf.json */}
                {appVersion && (
                    <>
                        <span className="text-slate-300 dark:text-zinc-800 select-none">|</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold select-none">v{appVersion}</span>
                    </>
                )}
            </div>
        </div>
    );
};
