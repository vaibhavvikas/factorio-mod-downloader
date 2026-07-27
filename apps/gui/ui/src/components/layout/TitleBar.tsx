import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Download, Heart, Folder } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppContext } from '../../context/AppContext';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE } from '../../theme/layers';

interface TitleBarProps {
    onOpenFolderModal?: () => void;
    configuredModsFolder?: string | null;
    hasAppUpdate?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
    onOpenFolderModal,
    configuredModsFolder,
    hasAppUpdate = false,
}) => {
    const { themeMode, setThemeMode, sidebarOpen, toggleSidebar, queue, profileOpen, setProfileOpen, isDownloading } = useAppContext();
    const appWindow = getCurrentWindow();
    const [isMac, setIsMac] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        setIsMac(navigator.userAgent.includes('Mac'));
    }, []);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        const updateMaximizedState = async () => {
            try {
                const maxed = await appWindow.isMaximized();
                setIsMaximized(maxed);
            } catch (e) {
                // Ignore error if window API not ready
            }
        };

        updateMaximizedState();

        const listen = async () => {
            try {
                unlisten = await appWindow.onResized(() => {
                    updateMaximizedState();
                });
            } catch (e) {
                // Ignore fallback
            }
        };

        listen();

        return () => {
            if (unlisten) unlisten();
        };
    }, [appWindow]);

    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = async () => {
        await appWindow.toggleMaximize();
        const maxed = await appWindow.isMaximized();
        setIsMaximized(maxed);
    };
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
                className={`hover:text-slate-800 dark:hover:text-zinc-200 ${INTERACTIVE.iconHover} w-11 h-10 flex items-center justify-center cursor-pointer transition-colors`}
                title="Minimize"
            >
                {/* VS Code Chrome Minimize Icon */}
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 10 10">
                    <path d="M0 5h10v1H0z" />
                </svg>
            </button>
            <button
                onClick={handleMaximize}
                className={`hover:text-slate-800 dark:hover:text-zinc-200 ${INTERACTIVE.iconHover} w-11 h-10 flex items-center justify-center cursor-pointer transition-colors`}
                title={isMaximized ? "Restore Down" : "Maximize"}
            >
                {isMaximized ? (
                    /* VS Code Chrome Restore Icon */
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 10 10">
                        <path d="M3 1h6v6H8V2H3V1z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M1 3h6v6H1V3zm1 1v4h4V4H2z" />
                    </svg>
                ) : (
                    /* VS Code Chrome Maximize Icon */
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 10 10">
                        <path fillRule="evenodd" clipRule="evenodd" d="M1 1h8v8H1V1zm1 1v6h6V2H2z" />
                    </svg>
                )}
            </button>
            <button
                onClick={handleClose}
                className="hover:bg-[#e81123] hover:text-white w-11 h-10 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
            >
                {/* VS Code Chrome Close Icon */}
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 10 10">
                    <path d="M1.02 0L0 1.02 3.98 5 0 8.98 1.02 10 5 6.02 8.98 10 10 8.98 6.02 5 10 1.02 8.98 0 5 3.98 1.02 0z" />
                </svg>
            </button>
        </div>
    );

    return (
        <div
            data-tauri-drag-region
            className={`relative h-10 ${LAYER.chromeHeavy} border-b ${DIVIDER.outer} flex items-center justify-between pl-4 shrink-0 transition-colors cursor-default select-none ${isMac ? 'pr-4' : 'pr-0'}`}
        >
            {/* Left Side: OS controls on Mac, Brand logo on Windows */}
            {isMac ? renderMacControls() : (
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide pointer-events-none">
                    <img src="/app.png" alt="Factorio Mod Downloader" className="w-4 h-4 object-contain rounded-xs" />
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
                    onClick={() => {
                        toggleSidebar(false);
                        setProfileOpen(false);
                        onOpenFolderModal && onOpenFolderModal();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md ${TEXT.secondary} hover:text-indigo-600 dark:hover:text-indigo-400 ${INTERACTIVE.iconHover} transition-all cursor-pointer flex items-center justify-center relative`}
                    title={configuredModsFolder ? `Mods Folder: ${configuredModsFolder}` : 'Configure Factorio Mods Folder'}
                >
                    <Folder className="w-3.5 h-3.5" />
                    {!configuredModsFolder && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    )}
                </button>

                {/* Downloads manager icon trigger */}
                <button
                    onClick={() => {
                        setProfileOpen(false);
                        toggleSidebar();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md transition-all cursor-pointer relative flex items-center justify-center ${sidebarOpen
                        ? (isDownloading ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/20' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20')
                        : (isDownloading ? 'text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400' : 'text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400')
                        }`}
                    title="Toggle Downloads Manager"
                >
                    <Download className="w-4 h-4" />
                    {queue.length > 0 && (
                        <span className={`absolute -top-1 -right-1 text-[9px] font-bold h-4 min-w-[16px] px-0.5 rounded-full flex items-center justify-center border-2 border-slate-50 dark:border-zinc-900 shadow-sm ${isDownloading
                            ? 'bg-indigo-500 text-white animate-pulse'
                            : 'bg-emerald-500 text-white'
                            }`}>
                            {queue.length}
                        </span>
                    )}
                </button>

                {/* Developer Profile & Support Trigger */}
                <button
                    onClick={() => {
                        const next = !profileOpen;
                        setProfileOpen(next);
                        if (next) {
                            toggleSidebar(false);
                        }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md transition-all cursor-pointer relative flex items-center justify-center ${profileOpen
                        ? 'text-rose-600 dark:text-rose-400'
                        : `${TEXT.secondary} hover:text-rose-600 dark:hover:text-rose-400`
                        }`}
                    title="Developer Profile & Support"
                >
                    <Heart className={`w-3.5 h-3.5 transition-all ${profileOpen ? 'fill-rose-500 text-rose-600 dark:text-rose-400' : 'fill-transparent'}`} />

                    {/* Pulsing Amber Update Dot Notification — only shown when app update is available */}
                    {hasAppUpdate && (
                        <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5 pointer-events-none">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                    )}
                </button>

                {/* 3-way Theme Pill Switcher */}
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`flex ${LAYER.pillSurface} ${BORDER.pill} p-0.5 rounded-lg ${TEXT.secondary}`}
                >
                    <button
                        onClick={() => setThemeMode('light')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'light' ? `${LAYER.contentCard} text-indigo-600 shadow-sm` : `bg-transparent ${INTERACTIVE.iconHover} hover:text-slate-800 dark:hover:text-zinc-200`}`}
                        title="Light Mode"
                    >
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode('dark')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'dark' ? `${LAYER.contentCard} text-indigo-400 shadow-sm` : `bg-transparent ${INTERACTIVE.iconHover} hover:text-slate-800 dark:hover:text-zinc-200`}`}
                        title="Dark Mode"
                    >
                        <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode('system')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${themeMode === 'system' ? `${LAYER.contentCard} text-indigo-600 dark:text-indigo-400 shadow-sm` : `bg-transparent ${INTERACTIVE.iconHover} hover:text-slate-800 dark:hover:text-zinc-200`}`}
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