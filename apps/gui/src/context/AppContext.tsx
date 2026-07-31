import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface DownloadTask {
    id: string;
    name: string;
    version: string;
    size: number;
    progress: number;
    speed: string;
    statusType?: 'completed' | 'alreadyExists' | 'updated' | 'downloading' | 'pending' | 'failed';
    errorMessage?: string;
}

export interface InstalledModItem {
    name: string;
    title: string;
    version: string;
    author?: string;
    factorioVersion?: string;
    category?: string;
    fileName: string;
    filePath: string;
    thumbnail?: string;
    dependencies: string[];
    hasUpdate: boolean;
    latestVersion?: string;
    newerVersions: string[];
    selectedTargetVersion?: string;
    selectedForUpdate?: boolean;
}

export interface LogMessage {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'success' | 'error';
    message: string;
}

import { invoke } from '@tauri-apps/api/core';

type ThemeMode = 'light' | 'dark' | 'system';
export type ActiveDrawer = 'downloads' | 'settings' | 'profile' | null;

interface AppContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDark: boolean;

    // Single active drawer state
    activeDrawer: ActiveDrawer;
    setActiveDrawer: (drawer: ActiveDrawer) => void;
    toggleDrawer: (drawer: ActiveDrawer) => void;

    sidebarOpen: boolean;
    toggleSidebar: (force?: boolean) => void;
    queue: DownloadTask[];
    startDownload: (items: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => void;
    clearCompleted: () => void;
    retryTask: (taskId: string) => void;
    cancelTask: (taskId: string) => void;
    cancelAllTasks: () => void;
    isDownloading: boolean;
    totalSpeed: number;
    statusBadgeText: string;
    logs: LogMessage[];
    addLog: (message: string, level?: 'info' | 'warn' | 'success' | 'error') => void;
    clearLogs: () => void;
    consoleOpen: boolean;
    setConsoleOpen: (open: boolean) => void;
    profileOpen: boolean;
    setProfileOpen: (open: boolean) => void;
    factorioVersion: string;
    setFactorioVersion: (version: string) => void;
    installedMods: InstalledModItem[];
    setInstalledMods: React.Dispatch<React.SetStateAction<InstalledModItem[]>>;
    folderPath: string;
    setFolderPath: (path: string) => void;
    refreshInstalledMods: (customPath?: string) => Promise<void>;
    loadingInstalled: boolean;
    isCheckingUpdates: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // —— THEME: Bootstrap from paint-before-react (head script, index.html) ——
    // Head script ran synchronously BEFORE React hydrates and set these attrs:
    //   data-pref-theme = 'light' | 'dark' | 'system'
    //   .dark class (if currently dark)
    //   data-is-dark = '1' (if currently dark)
    // We use those as initial state so React's VERY FIRST PAINT already matches
    // real theme → no 1-frame light flash.

    const getBootThemeMode = (): ThemeMode => {
        if (typeof document === 'undefined') return 'system';
        const attr = document.documentElement.getAttribute('data-pref-theme');
        if (attr === 'light' || attr === 'dark' || attr === 'system') return attr;
        return 'system';
    };
    const getBootIsDark = (): boolean => {
        if (typeof document === 'undefined') return true;
        if (document.documentElement.getAttribute('data-is-dark') === '1') return true;
        if (document.documentElement.classList.contains('dark')) return true;
        return typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    const [themeMode, setThemeModeState] = useState<ThemeMode>(getBootThemeMode);
    const [isDark, setIsDark] = useState<boolean>(getBootIsDark);

    // Single active drawer state — guarantees ONE panel open at a time
    const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);

    const toggleDrawer = (drawer: ActiveDrawer) => {
        setActiveDrawer(prev => (prev === drawer ? null : drawer));
    };

    const sidebarOpen = activeDrawer === 'downloads';
    const toggleSidebar = (force?: boolean) => {
        if (force === false) {
            if (activeDrawer === 'downloads') setActiveDrawer(null);
        } else if (force === true) {
            setActiveDrawer('downloads');
        } else {
            toggleDrawer('downloads');
        }
    };
    const [queue, setQueue] = useState<DownloadTask[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [totalSpeed, setTotalSpeed] = useState(0);
    const [statusBadgeText, setStatusBadgeText] = useState('Idle');
    const [factorioVersion, setFactorioVersionState] = useState<string>('2.1');
    const [installedMods, setInstalledMods] = useState<InstalledModItem[]>([]);
    const [folderPath, setFolderPath] = useState<string>('');
    const [loadingInstalled, setLoadingInstalled] = useState<boolean>(false);
    const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);

    // Grace period ref: after startDownload is called, we give the backend
    // up to 3 seconds to register the new tasks before allowing the poller
    // to set isDownloading=false. This prevents the premature idle→refresh
    // race that causes stale "update available" entries.
    const downloadGraceUntilRef = useRef<number>(0);

    // Load the saved visual preference before users interact with the theme picker.
    useEffect(() => {
        invoke<string>('get_theme_mode')
            .then(mode => {
                if (mode === 'light' || mode === 'dark' || mode === 'system') {
                    setThemeModeState(mode);
                    try { localStorage.setItem('fmd_theme_mode', mode); } catch (e) { }
                    // Also re-sync data attrs so head script + React stay in agreement
                    document.documentElement.setAttribute('data-pref-theme', mode);
                }
            })
            .catch(() => { });
    }, []);

    const setThemeMode = (mode: ThemeMode) => {
        if (mode === themeMode) return;

        const root = document.documentElement;
        const TRANSITION_MS = 420;

        // Mirror to localStorage for the paint-before-react head script on next boot.
        // (Rust-side persistence below is still the source of truth cross-session;
        //  localStorage is merely intra-process pre-paint cache.)
        try { localStorage.setItem('fmd_theme_mode', mode); } catch (e) { }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const targetIsDark = mode === 'system' ? mediaQuery.matches : mode === 'dark';
        const currentlyDark = root.classList.contains('dark');

        // Instantly update theme preference state & attributes
        setThemeModeState(mode);
        root.setAttribute('data-pref-theme', mode);

        // Persist to backend (cross-session source of truth)
        invoke('save_theme_mode', { themeMode: mode }).catch(() => { });

        // If visual dark mode target is identical to current visual state
        // (e.g. switching between Dark and System when System is Dark),
        // skip triggering the overlay transition.
        if (targetIsDark === currentlyDark) {
            return;
        }

        let existingTimer = (root as any).__themeTransitionTimer as number | undefined;
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        // 1. Capture app canvas bg as --theme-transition-bg
        const canvasEl = document.querySelector('#root > div') || document.body;
        let bg = window.getComputedStyle(canvasEl).backgroundColor;
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
            bg = currentlyDark ? 'rgb(24, 24, 27)' : 'rgb(241, 245, 249)';
        }
        root.style.setProperty('--theme-transition-bg', bg);

        // 2. Set transitioning flag (CSS pseudo overlay captures bg, opacity 1->0)
        root.setAttribute('data-theme-transitioning', '');

        // 3. Cleanup after 420 ms
        (root as any).__themeTransitionTimer = window.setTimeout(() => {
            root.removeAttribute('data-theme-transitioning');
            root.style.removeProperty('--theme-transition-bg');
            delete (root as any).__themeTransitionTimer;
        }, TRANSITION_MS);
    };

    // Load persisted Factorio target version on boot
    useEffect(() => {
        invoke<string>('get_factorio_version')
            .then(ver => {
                if (ver) setFactorioVersionState(ver);
            })
            .catch(() => { });
    }, []);

    const setFactorioVersion = (ver: string) => {
        setFactorioVersionState(ver);
        invoke('save_factorio_version', { version: ver }).catch(() => { });
        addLog(`Explore filter set to Factorio ${ver === 'all' || ver === 'any' ? 'Any Version' : ver}`, 'info');
    };

    // Developer console logger states
    const [logs, setLogs] = useState<LogMessage[]>([
        { id: 'init', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'System active.' }
    ]);
    const [consoleOpen, setConsoleOpen] = useState(false);

    const profileOpen = activeDrawer === 'profile';
    const setProfileOpen = (open: boolean | ((prev: boolean) => boolean)) => {
        if (typeof open === 'function') {
            setActiveDrawer(prev => (open(prev === 'profile') ? 'profile' : null));
        } else {
            setActiveDrawer(open ? 'profile' : null);
        }
    };

    const addLog = (message: string, level: 'info' | 'warn' | 'success' | 'error' = 'info') => {
        setLogs(prev => [
            ...prev,
            {
                id: Math.random().toString(),
                timestamp: new Date().toLocaleTimeString(),
                level,
                message
            }
        ].slice(-100)); // Cap logs at last 100 entries
    };

    const clearLogs = () => setLogs([]);

    // Unified Refresh: Scans local disk zip files first, then automatically
    // checks the Mod Portal API in parallel for online updates.
    const refreshInstalledMods = async (customPath?: string) => {
        let path = customPath || folderPath;
        if (!path) {
            try {
                const detected = await invoke<string | null>('get_mods_folder');
                path = detected || await invoke<string>('detect_default_mods_folder');
            } catch (err) {
                console.error('Failed to get mods folder path:', err);
                return;
            }
        }
        if (!path) return;

        setFolderPath(path);
        setLoadingInstalled(true);
        setIsCheckingUpdates(true);

        try {
            addLog('Scanning installed mods...', 'info');
            const rawList = await invoke<InstalledModItem[]>('get_installed_mods_info', { modsFolder: path });
            const listWithSelection = rawList.map(item => ({
                ...item,
                selectedForUpdate: item.hasUpdate,
                selectedTargetVersion: item.newerVersions[0] || item.version
            }));
            setInstalledMods(listWithSelection);
            setLoadingInstalled(false);

            if (rawList.length > 0) {
                addLog(`Loaded ${rawList.length} installed mod(s). Checking for updates in parallel...`, 'info');
                let updatesFoundCount = 0;

                await Promise.all(
                    rawList.map(async (modItem) => {
                        try {
                            const checked = await invoke<InstalledModItem>('check_single_mod_update', {
                                installedMod: modItem,
                                factorioVersion
                            });

                            const updatedItem: InstalledModItem = {
                                ...checked,
                                selectedForUpdate: checked.hasUpdate,
                                selectedTargetVersion: checked.latestVersion || checked.newerVersions[0] || checked.version
                            };

                            if (checked.hasUpdate) {
                                updatesFoundCount++;
                            }

                            // Stream each mod update to UI live as it resolves!
                            setInstalledMods(prev =>
                                prev.map(m => (m.name === updatedItem.name ? updatedItem : m))
                            );
                        } catch (err) {
                            console.error(`Failed to check update for mod ${modItem.name}:`, err);
                        }
                    })
                );

                addLog(`Scan & update check complete. ${updatesFoundCount} update${updatesFoundCount === 1 ? '' : 's'} available for Factorio ${factorioVersion === 'all' || factorioVersion === 'any' ? 'Any Version' : factorioVersion}.`, 'success');
            }
        } catch (err: any) {
            addLog(`Failed to scan installed mods: ${err?.toString() || 'Unknown error'}`, 'error');
        } finally {
            setLoadingInstalled(false);
            setIsCheckingUpdates(false);
        }
    };

    // Re-check installed mods & updates whenever factorioVersion changes
    useEffect(() => {
        if (folderPath) {
            refreshInstalledMods(folderPath);
        }
    }, [factorioVersion]);

    // Trigger initial scan & update check on mount
    useEffect(() => {
        refreshInstalledMods();
    }, []);

    // Trigger refresh when download queue transitions to idle
    const [prevDownloading, setPrevDownloading] = useState(false);
    useEffect(() => {
        if (prevDownloading && !isDownloading) {
            refreshInstalledMods();
        }
        setPrevDownloading(isDownloading);
    }, [isDownloading, prevDownloading]);

    // Handle Theme mode application and tracking
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            const activeDark = themeMode === 'system' ? mediaQuery.matches : themeMode === 'dark';
            const currentlyDark = document.documentElement.classList.contains('dark');

            // Skip redundant identical toggle — prevents a phantom 1-frame
            // recomposite when head script already set the correct class.
            if (activeDark === currentlyDark) {
                setIsDark(activeDark);
                if (activeDark) document.documentElement.setAttribute('data-is-dark', '1');
                else document.documentElement.removeAttribute('data-is-dark');
                return;
            }

            setIsDark(activeDark);
            if (activeDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-is-dark', '1');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.removeAttribute('data-is-dark');
            }
        };

        applyTheme();

        if (themeMode === 'system') {
            const onSysChange = () => {
                const root = document.documentElement;
                const TRANSITION_MS = 420;

                let existingTimer = (root as any).__themeTransitionTimer as number | undefined;
                if (existingTimer !== undefined) {
                    window.clearTimeout(existingTimer);
                }

                const canvasEl = document.querySelector('#root > div') || document.body;
                let bg = window.getComputedStyle(canvasEl).backgroundColor;
                if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
                    const currentlyDark = root.classList.contains('dark');
                    bg = currentlyDark ? 'rgb(24, 24, 27)' : 'rgb(241, 245, 249)';
                }
                root.style.setProperty('--theme-transition-bg', bg);
                root.setAttribute('data-theme-transitioning', '');

                applyTheme();

                (root as any).__themeTransitionTimer = window.setTimeout(() => {
                    root.removeAttribute('data-theme-transitioning');
                    root.style.removeProperty('--theme-transition-bg');
                    delete (root as any).__themeTransitionTimer;
                }, TRANSITION_MS);
            };
            mediaQuery.addEventListener('change', onSysChange);
            return () => mediaQuery.removeEventListener('change', onSysChange);
        }
    }, [themeMode]);

    const clearCompleted = async () => {
        try {
            await invoke('clear_completed_download_tasks');
            setQueue(prev => prev.filter(q => q.progress < 100 && q.statusType !== 'completed' && q.statusType !== 'alreadyExists' && q.statusType !== 'updated'));
        } catch (err) {
            console.error('Failed to clear completed tasks:', err);
        }
    };

    const retryTask = async (taskId: string) => {
        try {
            let path = await invoke<string | null>('get_mods_folder');
            if (!path) {
                path = await invoke<string>('detect_default_mods_folder');
            }
            await invoke('retry_download_task', { taskId, outputDir: path || '' });
            addLog(`Retrying download for task "${taskId}"...`, 'info');
        } catch (err: any) {
            addLog(`Failed to retry task "${taskId}": ${err?.toString()}`, 'error');
        }
    };
    const cancelTask = async (taskId: string) => {
        try {
            await invoke('cancel_download_task', { taskId });
            setQueue(prev => prev.map(q => q.id === taskId ? { ...q, statusType: 'failed', errorMessage: 'Cancelled by user' } : q));
            addLog(`Cancelled download for task "${taskId}"`, 'warn');
        } catch (err: any) {
            addLog(`Failed to cancel task "${taskId}": ${err?.toString()}`, 'error');
        }
    };

    const cancelAllTasks = async () => {
        try {
            await invoke('cancel_all_download_tasks');
            setQueue(prev => prev.map(q => (q.progress < 100 && q.statusType !== 'completed' && q.statusType !== 'alreadyExists' && q.statusType !== 'updated') ? { ...q, statusType: 'failed', errorMessage: 'Cancelled by user' } : q));
            addLog('Cancelled all active downloads', 'warn');
        } catch (err: any) {
            addLog(`Failed to cancel all tasks: ${err?.toString()}`, 'error');
        }
    };

    const startDownload = (newItems: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => {
        setActiveDrawer('downloads');
        setStatusBadgeText(type === 'update' ? 'Patching...' : 'Downloading...');
        addLog(`Initiated download queue: ${type === 'update' ? 'Updating' : 'Downloading'} ${newItems.length} mod(s)...`, 'info');

        const initializedItems = newItems.map(item => ({
            ...item,
            progress: 0,
            speed: (Math.random() * 5 + 3).toFixed(1)
        }));

        setQueue(prev => [...prev, ...initializedItems]);
        setIsDownloading(true);
        // Set a 3-second grace window so the poller doesn't prematurely
        // flip isDownloading=false before the backend registers the tasks.
        downloadGraceUntilRef.current = Date.now() + 3000;
    };

    // Tracking completed and failed tasks for logs
    const [loggedTaskIds, setLoggedTaskIds] = useState<string[]>([]);
    useEffect(() => {
        queue.forEach(item => {
            if (!loggedTaskIds.includes(item.id)) {
                if (item.progress >= 100 || item.statusType === 'completed' || item.statusType === 'alreadyExists' || item.statusType === 'updated') {
                    setLoggedTaskIds(prev => [...prev, item.id]);
                    addLog(`Download complete: "${item.name}" (v${item.version}) successfully downloaded.`, 'success');
                } else if (item.statusType === 'failed') {
                    setLoggedTaskIds(prev => [...prev, item.id]);
                    const is404 = item.errorMessage?.includes('404');
                    if (is404) {
                        addLog(`Mod "${item.name}" (v${item.version}) was not found on server (404). It might be recently added and not yet available on the mirror storage.`, 'warn');
                    } else {
                        addLog(`Download failed for "${item.name}" (v${item.version}): ${item.errorMessage || 'Network request failed after retries'}`, 'error');
                    }
                }
            }
        });
    }, [queue, loggedTaskIds]);

    // Real Rust Downloader Engine Poller (polls Rust backend get_download_tasks every 300ms)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const tasks = await invoke<Array<{
                    id: string;
                    title: string;
                    version: string;
                    fileName: string;
                    sha1: string;
                    downloadedBytes: number;
                    totalBytes: number;
                    status: { status: string; message?: string } | string;
                }>>('get_download_tasks');

                if (tasks && tasks.length > 0) {
                    const formatted: DownloadTask[] = tasks.map(t => {
                        const totalMb = t.totalBytes > 0 ? (t.totalBytes / (1024 * 1024)) : 15.0;
                        const downloadedMb = (t.downloadedBytes / (1024 * 1024));
                        let statusStr = typeof t.status === 'string' ? t.status : (t.status?.status || 'pending');

                        let progress = 0;
                        if (statusStr === 'completed' || statusStr === 'alreadyExists' || statusStr === 'updated') {
                            progress = 100;
                        } else if (t.totalBytes > 0) {
                            progress = Math.min(100, Math.round((t.downloadedBytes / t.totalBytes) * 100));
                        }

                        let statusTyped: DownloadTask['statusType'] = 'pending';
                        let errorMsg: string | undefined = undefined;
                        if (typeof t.status === 'string') {
                            statusTyped = t.status as any;
                        } else if (t.status?.status) {
                            statusTyped = t.status.status as any;
                            errorMsg = t.status.message;
                        }

                        return {
                            id: `${t.id}_${t.version}`,
                            name: t.title || t.id,
                            version: t.version,
                            size: parseFloat(totalMb.toFixed(1)),
                            progress: progress,
                            speed: downloadedMb > 0 ? '4.8' : '0.0',
                            statusType: statusTyped,
                            errorMessage: errorMsg,
                        };
                    });

                    setQueue(formatted);

                    const isAnyActive = tasks.some(t => {
                        const s = typeof t.status === 'string' ? t.status : (t.status?.status || 'pending');
                        return s === 'downloading' || s === 'pending';
                    });

                    if (!isAnyActive && Date.now() < downloadGraceUntilRef.current) {
                        // Skip — keep isDownloading=true until grace expires
                    } else {
                        if (isAnyActive) {
                            // Backend has registered the tasks; grace no longer needed
                            downloadGraceUntilRef.current = 0;
                        }
                        setIsDownloading(isAnyActive);
                    }
                    setTotalSpeed(isAnyActive ? 8.4 : 0);
                    if (isAnyActive) {
                        setStatusBadgeText('Downloading...');
                    } else if (tasks.length > 0) {
                        setStatusBadgeText('All Complete');
                    }
                }
            } catch (err) {
                // Ignore if not in desktop mode
            }
        }, 300);

        return () => clearInterval(interval);
    }, []);

    return (
        <AppContext.Provider value={{
            themeMode,
            setThemeMode,
            isDark,
            activeDrawer,
            setActiveDrawer,
            toggleDrawer,
            sidebarOpen,
            toggleSidebar,
            queue,
            startDownload,
            clearCompleted,
            retryTask,
            cancelTask,
            cancelAllTasks,
            isDownloading,
            totalSpeed,
            statusBadgeText,
            logs,
            addLog,
            clearLogs,
            consoleOpen,
            setConsoleOpen,
            profileOpen,
            setProfileOpen,
            factorioVersion,
            setFactorioVersion,
            installedMods,
            setInstalledMods,
            folderPath,
            setFolderPath,
            refreshInstalledMods,
            loadingInstalled,
            isCheckingUpdates
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within AppProvider");
    return context;
};
