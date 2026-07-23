import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Minus, Square, X, Download, Heart, Folder } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppContext } from '../../context/AppContext';

interface TitleBarProps {
    onOpenFolderModal?: () => void;
    configuredModsFolder?: string | null;
}

export const TitleBar: React.FC<TitleBarProps> = ({
    onOpenFolderModal,
    configuredModsFolder,
}) => {
    const { themeMode, setThemeMode, sidebarOpen, toggleSidebar, queue, profileOpen, setProfileOpen, isDownloading } = useAppContext();
    const appWindow = getCurrentWindow();
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(navigator.userAgent.includes('Mac'));
    }, []);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = () => appWindow.toggleMaximize();
    const handleClose = () => appWindow.close();

    const [hoverControls, setHoverControls] = useState(false);

    // Render macOS style traffic light buttons
    const renderMacControls = () => (
        <div
            className="flex items-center gap-1.5 mr-4 h-6"
            onMouseEnter={() => setHoverControls(true)}
            onMouseLeave={() => setHoverControls(false)}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Close Button */}
            <button
                onClick={handleClose}
                className="w-3 h-3 rounded-full bg-[#ff5f56] active:bg-[#e04a42] border border-[#e0443e]/40 cursor-pointer flex items-center justify-center transition-all duration-100"
            >
                <svg viewBox="0 0 12 12" className={`w-3 h-3 stroke-[1.2] stroke-[#4c0002]/85 transition-opacity duration-75 ${hoverControls ? 'opacity-100' : 'opacity-0'}`}>
                    <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
                </svg>
            </button>
            {/* Minimize Button */}
            <button
                onClick={handleMinimize}
                className="w-3 h-3 rounded-full bg-[#ffbd2e] active:bg-[#dfa016] border border-[#df9b12]/40 cursor-pointer flex items-center justify-center transition-all duration-100"
            >
                <svg viewBox="0 0 12 12" className={`w-3 h-3 stroke-[1.5] stroke-[#5c3e00]/90 transition-opacity duration-75 ${hoverControls ? 'opacity-100' : 'opacity-0'}`}>
                    <path d="M2.5 6h7" />
                </svg>
            </button>
            {/* Zoom / Maximize Button */}
            <button
                onClick={handleMaximize}
                className="w-3 h-3 rounded-full bg-[#27c93f] active:bg-[#1da42a] border border-[#1da129]/40 cursor-pointer flex items-center justify-center transition-all duration-100"
            >
                <svg viewBox="0 0 12 12" className={`w-3 h-3 stroke-[1.2] stroke-[#024d06]/90 fill-none transition-opacity duration-75 ${hoverControls ? 'opacity-100' : 'opacity-0'}`}>
                    <path d="M2.5 5.5V2.5h3M2.5 2.5l3.5 3.5M9.5 6.5V9.5h-3M9.5 9.5L6 6" />
                </svg>
            </button>
        </div>
    );

    // Render Windows/Linux style buttons
    const renderWindowsControls = () => (
        <div
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center text-slate-400 dark:text-zinc-500 text-xs ml-2 border-l border-slate-200 dark:border-zinc-800/80 pl-2 h-10 shrink-0 select-none"
        >
            <button
                onClick={handleMinimize}
                className="hover:text-slate-850 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800/60 w-11 h-10 flex items-center justify-center cursor-pointer transition-colors"
                title="Minimize"
            >
                <Minus className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={handleMaximize}
                className="hover:text-slate-850 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800/60 w-11 h-10 flex items-center justify-center cursor-pointer transition-colors"
                title="Maximize"
            >
                <Square className="w-3 h-3" />
            </button>
            <button
                onClick={handleClose}
                className="hover:bg-[#e81123] hover:text-white w-11 h-10 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );

    return (
        <div
            data-tauri-drag-region
            onMouseDown={() => appWindow.startDragging()}
            onDoubleClick={handleMaximize}
            className={`relative h-10 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800/60 flex items-center justify-between pl-4 shrink-0 transition-colors cursor-default select-none ${isMac ? 'pr-4' : 'pr-0'}`}
        >
            {/* Left Side: OS controls on Mac, Brand logo on Windows */}
            {isMac ? renderMacControls() : (
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide pointer-events-none">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
                    <span className="text-slate-900 dark:text-zinc-50">Factorio Mod Downloader</span>
                </div>
            )}

            {/* Centered Brand Title for Mac */}
            {isMac && (
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide pointer-events-none absolute left-1/2 -translate-x-1/2">
                    <span className="text-slate-900 dark:text-zinc-50">Factorio Mod Downloader</span>
                </div>
            )}
            {/* Right Side Controls / Switcher */}
            <div className="flex items-center gap-2.5 ml-auto z-10">
                {/* Factorio Mods Folder Settings trigger */}
                <button
                    onClick={() => onOpenFolderModal && onOpenFolderModal()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800/60 transition-all cursor-pointer flex items-center justify-center relative"
                    title={configuredModsFolder ? `Mods Folder: ${configuredModsFolder}` : 'Configure Factorio Mods Folder'}
                >
                    <Folder className="w-3.5 h-3.5" />
                    {!configuredModsFolder && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    )}
                </button>

                {/* Downloads manager icon trigger */}
                <button
                    onClick={() => toggleSidebar()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md transition-all cursor-pointer relative flex items-center justify-center ${sidebarOpen
                        ? (isDownloading ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/20' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20')
                        : (isDownloading ? 'text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400' : 'text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400')
                        }`}
                    title="Toggle Downloads Manager"
                >
                    <Download className="w-4 h-4" />
                    {queue.length > 0 && (
                        <span className={`absolute -top-1 -right-1 text-[9px] font-bold h-4 min-w-[16px] px-0.5 rounded-full flex items-center justify-center border-2 border-slate-50 dark:border-zinc-950 shadow-sm ${isDownloading
                            ? 'bg-indigo-500 text-white animate-pulse'
                            : 'bg-emerald-500 text-white'
                            }`}>
                            {queue.length}
                        </span>
                    )}
                </button>

                {/* Developer Profile & Support Trigger */}
                <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md transition-all cursor-pointer relative flex items-center justify-center ${profileOpen
                        ? 'text-rose-600 dark:text-rose-455'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-455'
                        }`}
                    title="Developer Profile & Support"
                >
                    <Heart className={`w-3.5 h-3.5 transition-all ${profileOpen ? 'fill-rose-500 text-rose-600 dark:text-rose-450' : 'fill-transparent'}`} />

                    {/* Pulsing Amber Update Dot Notification */}
                    <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5 pointer-events-none">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                </button>

                {/* 3-way Theme Pill Switcher */}
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex bg-slate-200/50 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200/80 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400"
                >
                    <button
                        onClick={() => setThemeMode('light')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'bg-transparent hover:bg-slate-300/40 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                        title="Light Mode"
                    >
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode('dark')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'dark' ? 'bg-white dark:bg-zinc-800 text-indigo-400 shadow-sm' : 'bg-transparent hover:bg-slate-300/40 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                        title="Dark Mode"
                    >
                        <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode('system')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'system' ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-transparent hover:bg-slate-300/40 dark:hover:bg-zinc-800/60 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                        title="System Default"
                    >
                        <Monitor className="w-3.5 h-3.5" />
                    </button>
                </div>

                {!isMac && renderWindowsControls()}
            </div>
        </div>
    );
};