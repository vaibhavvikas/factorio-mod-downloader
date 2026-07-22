import React, { useState } from 'react';
import { FolderOpen, Edit3, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export const InstalledTab: React.FC = () => {
    const { startDownload } = useAppContext();
    const [folderPath, setFolderPath] = useState('C:\\Users\\Vaibhav\\AppData\\Roaming\\Factorio\\mods');

    const handleUpdate = () => {
        startDownload([
            { id: 'u1-' + Date.now(), name: 'Space Exploration', version: '0.6.118', size: 184.2 }
        ], 'update');
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-100 dark:bg-zinc-950">
            {/* Pinned Top path summary */}
            <div className="pt-3 px-6 pb-2 shrink-0 flex flex-col gap-4">
                <div className="p-3.5 bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800/80 rounded-xl flex items-center justify-between text-xs shadow-sm">
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300 overflow-hidden">
                        <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-400 dark:text-zinc-500">Mods Path:</span>
                        <span className="font-mono text-[11px] truncate text-slate-900 dark:text-zinc-100">{folderPath}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setFolderPath(prompt("Select new path:", folderPath) || folderPath)} className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-3 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-zinc-800/80 cursor-pointer flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-indigo-500" /> Change Folder
                        </button>
                        <button className="bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-zinc-800/80 cursor-pointer">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex gap-1 bg-slate-200/40 dark:bg-zinc-950 p-1 rounded-lg border border-slate-200 dark:border-zinc-800/60 text-xs">
                        <button className="px-3 py-1 rounded bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-medium shadow-sm">All Installed (5)</button>
                        <button className="px-3 py-1 rounded text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">Updates Available (3)</button>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Factorio v1.1.100 Detected</span>
                </div>
            </div>

            {/* Scrollable list area */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
                <div className="border border-slate-200 dark:border-zinc-800/80 rounded-xl overflow-hidden bg-white/60 dark:bg-zinc-900/40 divide-y divide-slate-200/80 dark:divide-zinc-800/60 shadow-sm">
                    <div className="p-3.5 flex items-center justify-between bg-indigo-500/[0.01] hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-400 dark:border-zinc-700 text-indigo-600" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Space Exploration</span>
                                    <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[9px] px-1.5 py-0.2 rounded font-semibold font-mono animate-pulse">Update Available</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">Installed: <span className="text-amber-500 font-medium">v0.6.115</span> ➔ Latest: <span className="text-emerald-500 font-bold">v0.6.118</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-400">184.2 MB</span>
                            <button onClick={handleUpdate} className="bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer">Update</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pinned Bottom update action */}
            <div className="px-6 pb-6 pt-3 shrink-0 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 dark:to-transparent">
                <button 
                    onClick={handleUpdate} 
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer select-none"
                >
                    <RefreshCw className="w-4 h-4" /> <span>Update Selected Mods</span>
                </button>
            </div>
        </div>
    );
};