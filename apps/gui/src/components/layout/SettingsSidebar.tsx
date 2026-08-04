import React, { useState, useRef, useEffect } from 'react';
import { Settings, FolderOpen, FolderSearch, Gamepad2, Palette, Sun, Moon, Monitor, X, ChevronDown, Check, FolderCog, Wand2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { invoke } from '@tauri-apps/api/core';
import { LAYER, BORDER, DIVIDER, TEXT, INTERACTIVE, HOVER_BORDER } from '../../theme/layers';
import { Tooltip } from '../ui/Tooltip';

function splitPathForMiddleTruncate(path: string): { head: string; tail: string } {
    if (!path) return { head: '', tail: '' };
    const sep = path.includes('/') ? '/' : '\\';
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) {
        return { head: path, tail: '' };
    }
    const tailParts = parts.slice(-2);
    const headParts = parts.slice(0, -2);
    const head = headParts.join(sep) + sep;
    const tail = tailParts.join(sep);
    return { head, tail };
}

export const SettingsSidebar: React.FC = () => {
    const {
        activeDrawer,
        toggleDrawer,
        folderPath,
        setFolderPath,
        refreshInstalledMods,
        factorioVersion,
        setFactorioVersion,
        validFactorioVersions,
        themeMode,
        setThemeMode,
        addLog
    } = useAppContext();

    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsVersionDropdownOpen(false);
            }
        };
        if (isVersionDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVersionDropdownOpen]);

    const isOpen = activeDrawer === 'settings';

    const handleBrowseFolder = async () => {
        try {
            const newPath = await invoke<string | null>('pick_mods_folder_dialog');
            if (newPath) {
                setFolderPath(newPath);
                await invoke('save_mods_folder', { path: newPath });
                await refreshInstalledMods(newPath);
                addLog(`Updated Factorio mods folder to: ${newPath}`, 'success');
            }
        } catch (err) {
            console.error('Failed to pick folder:', err);
        }
    };

    const handleAutoDetect = async () => {
        try {
            const detected = await invoke<string>('detect_default_mods_folder');
            if (detected) {
                setFolderPath(detected);
                await invoke('save_mods_folder', { path: detected });
                await refreshInstalledMods(detected);
                addLog(`Auto-detected Factorio mods folder: ${detected}`, 'success');
            }
        } catch (err) {
            console.error('Failed to auto-detect folder:', err);
        }
    };

    const handleOpenExplorer = async () => {
        if (!folderPath) return;
        try {
            await invoke('open_folder_in_explorer', { path: folderPath });
        } catch (err) {
            console.error('Failed to open folder:', err);
        }
    };

    const pathSplit = folderPath ? splitPathForMiddleTruncate(folderPath) : null;

    const versionOptions = validFactorioVersions.map(opt => ({
        id: opt.value,
        label: opt.label
    }));

    const themeOptions = [
        { id: 'light', label: 'Light', icon: Sun },
        { id: 'dark', label: 'Dark', icon: Moon },
        { id: 'system', label: 'System', icon: Monitor },
    ];

    return (
        <div
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 2rem))' }}
            className={`absolute right-4 top-2 bottom-4 w-[380px] z-40 ${LAYER.groupPanel} backdrop-blur-md rounded-lg ${BORDER.outer} flex flex-col shrink-0 transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'opacity-100 shadow-2xl pointer-events-auto' : 'opacity-0 shadow-none pointer-events-none'}`}
        >
            {/* Header section */}
            <div className={`h-9 min-h-9 max-h-9 px-3.5 border-b ${DIVIDER.outer} flex items-center justify-between ${LAYER.viewportHeader} shrink-0 select-none`}>
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-zinc-200">
                    <Settings className="w-3.5 h-3.5 text-blue-500" />
                    <span>Application Settings</span>
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip content="Open Config Folder">
                        <button
                            onClick={async () => {
                                try {
                                    await invoke('open_config_folder');
                                    addLog('Opened local config folder in File Explorer', 'info');
                                } catch (err) {
                                    console.error('Failed to open config folder:', err);
                                }
                            }}
                            className={`${TEXT.muted} hover:text-blue-500 dark:hover:text-blue-400 p-1 rounded transition-colors cursor-pointer ${INTERACTIVE.iconHover}`}
                        >
                            <FolderCog className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" />
                        </button>
                    </Tooltip>
                    {!folderPath ? (
                        <Tooltip content="Please select a valid Factorio mods directory to continue">
                            <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Folder Required
                            </span>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={() => toggleDrawer(null)}
                            aria-label="Close Settings"
                            className={`${TEXT.muted} hover:text-slate-700 dark:hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer ${INTERACTIVE.iconHover}`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Body Content */}
            <div className={`scroller-panel card flex-1 flex flex-col gap-3 p-4 overflow-y-auto ${LAYER.innerRecessed}`}>
                {/* Section 1: Factorio Game Version */}
                <div className={`${LAYER.cardSurface} ${BORDER.card} rounded-xl p-4 flex flex-col gap-3 shadow-sm`}>
                    <div className="flex items-center gap-2.5 select-none">
                        <Gamepad2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Game Version</div>
                    </div>
                    <p className={`text-[10.5px] leading-snug ${TEXT.secondary}`}>
                        Select target Factorio version for mod search and dependency resolution.
                    </p>

                    {/* IDE-style Rich Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        {(() => {
                            const selectedOpt = versionOptions.find(v => v.id === factorioVersion) || versionOptions[0];
                            return (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl ${LAYER.innerRecessed} ${BORDER.inner} font-mono text-xs text-slate-800 dark:text-zinc-200 cursor-pointer select-none group/trigger transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 shadow-2xs`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Gamepad2 className="w-4 h-4 text-slate-500 dark:text-zinc-400 group-hover/trigger:text-blue-500 dark:group-hover/trigger:text-[#58a6ff] shrink-0 transition-colors" />
                                            <span className="font-bold truncate">
                                                {selectedOpt.label}
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover/trigger:text-blue-500 dark:group-hover/trigger:text-[#58a6ff] shrink-0 transition-transform duration-200 ${isVersionDropdownOpen ? 'rotate-180 text-blue-500 dark:text-[#58a6ff]' : ''}`} />
                                    </button>

                                    {/* Floating Popover List */}
                                    {isVersionDropdownOpen && (
                                        <div className={`absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl ${BORDER.dropdown} ${LAYER.floatingPanel} backdrop-blur-xl shadow-xl p-1.5 flex flex-col gap-0.5 max-h-60 overflow-y-auto scroller-dropdown loose animate-fade-in`}>
                                            {versionOptions.map(ver => {
                                                const isSelected = factorioVersion === ver.id;
                                                return (
                                                    <button
                                                        key={ver.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setFactorioVersion(ver.id);
                                                            setIsVersionDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${isSelected
                                                            ? 'bg-blue-500/15 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-500/25 dark:hover:bg-blue-900/80'
                                                            : `hover:bg-slate-200/80 dark:hover:bg-zinc-700/80 text-slate-800 dark:text-zinc-100`
                                                            }`}
                                                    >
                                                        <span className="text-xs font-mono font-semibold">{ver.label}</span>
                                                        {isSelected && (
                                                            <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 stroke-[2.5]" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Section 2: Mods Folder Location */}
                <div className={`${LAYER.cardSurface} ${BORDER.card} rounded-xl p-4 flex flex-col gap-3 shadow-sm`}>
                    <div className="flex items-center gap-2.5 select-none">
                        <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Mods Folder</div>
                    </div>
                    <p className={`text-[10.5px] leading-snug ${TEXT.secondary}`}>
                        Directory where installed Factorio `.zip` mod files are loaded.
                    </p>

                    {/* Stacked Full-Width Path Bar & Action Buttons Below */}
                    <div className="flex flex-col gap-2">
                        {/* 100% Width Path Bar with Dynamic Flexbox Middle Truncation */}
                        <Tooltip content={folderPath ? `Full Mods Directory: ${folderPath}` : null} className="w-full">
                            <div className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${LAYER.innerRecessed} ${BORDER.inner} font-mono text-[11px] text-slate-800 dark:text-zinc-200 overflow-hidden cursor-default`}>
                                <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                                {pathSplit ? (
                                    <div className="flex items-center min-w-0 font-mono font-semibold text-[11px] text-slate-800 dark:text-zinc-200 select-all overflow-hidden w-full">
                                        <span className="truncate shrink min-w-0">{pathSplit.head}</span>
                                        {pathSplit.tail && <span className="shrink-0">{pathSplit.tail}</span>}
                                    </div>
                                ) : (
                                    <span className="font-mono font-semibold text-[11px] text-slate-400">Not configured</span>
                                )}
                            </div>
                        </Tooltip>

                        {/* Action Buttons Row — Spanning across layout with proportional space for Auto-Detect */}
                        <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-2 w-full">
                            <Tooltip content="Browse or choose a different Factorio mods folder" className="w-full">
                                <button
                                    onClick={handleBrowseFolder}
                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-transparent ${BORDER.pill} ${HOVER_BORDER.cardBright} hover:bg-slate-200/60 dark:hover:bg-[#21262d] ${INTERACTIVE.pillHover} active:scale-95 transition-all text-slate-800 dark:text-zinc-200 font-semibold text-xs cursor-pointer group shadow-2xs`}
                                >
                                    <FolderSearch className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-blue-500 dark:group-hover:text-[#58a6ff] shrink-0 transition-colors" />
                                    <span className="truncate">Browse</span>
                                </button>
                            </Tooltip>

                            <Tooltip content="Auto-detect standard Factorio mods folder for your OS" className="w-full">
                                <button
                                    onClick={handleAutoDetect}
                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-transparent ${BORDER.pill} ${HOVER_BORDER.cardBright} hover:bg-slate-200/60 dark:hover:bg-[#21262d] ${INTERACTIVE.pillHover} active:scale-95 transition-all text-slate-800 dark:text-zinc-200 font-semibold text-xs cursor-pointer group shadow-2xs`}
                                >
                                    <Wand2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-blue-500 dark:group-hover:text-[#58a6ff] shrink-0 transition-colors" />
                                    <span className="truncate">Auto-Detect</span>
                                </button>
                            </Tooltip>

                            <Tooltip content="Open folder in File Explorer" className="w-full">
                                <button
                                    onClick={handleOpenExplorer}
                                    disabled={!folderPath}
                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-transparent ${BORDER.pill} ${HOVER_BORDER.cardBright} hover:bg-slate-200/60 dark:hover:bg-[#21262d] ${INTERACTIVE.pillHover} active:scale-95 transition-all text-slate-800 dark:text-zinc-200 font-semibold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group shadow-2xs`}
                                >
                                    <FolderOpen className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 group-hover:text-blue-500 dark:group-hover:text-[#58a6ff] shrink-0 transition-colors" />
                                    <span className="truncate">Open</span>
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Section 3: App Theme Preference */}
                <div className={`${LAYER.cardSurface} ${BORDER.card} rounded-xl p-4 flex flex-col gap-3 shadow-sm`}>
                    <div className="flex items-center gap-2.5 select-none">
                        <Palette className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Theme</div>
                    </div>
                    <p className={`text-[10.5px] leading-snug ${TEXT.secondary}`}>
                        Choose visual theme preference.
                    </p>

                    {/* Unified Segmented Control */}
                    <div className={`p-1 rounded-xl ${LAYER.innerRecessed} ${BORDER.inner} flex items-center gap-1 select-none`}>
                        {themeOptions.map(t => {
                            const Icon = t.icon;
                            const isSelected = themeMode === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setThemeMode(t.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all duration-200 cursor-pointer select-none ${isSelected
                                        ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-[#58a6ff] font-bold shadow-xs border border-slate-200/80 dark:border-[#30363d]'
                                        : `text-slate-600 dark:text-[#8b949e] hover:text-slate-900 dark:hover:text-[#f0f6fc] font-semibold border border-transparent hover:bg-slate-200/50 dark:hover:bg-[#161b22]/60`
                                        }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-[#58a6ff]' : 'text-slate-500 dark:text-zinc-400'}`} />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
