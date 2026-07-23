import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface DownloadTask {
    id: string;
    name: string;
    version: string;
    size: number;
    progress: number;
    speed: string;
    statusType?: 'completed' | 'alreadyExists' | 'updated' | 'downloading' | 'pending' | 'failed';
}

export interface LogMessage {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'success' | 'error';
    message: string;
}

import { invoke } from '@tauri-apps/api/core';

type ThemeMode = 'light' | 'dark' | 'system';

interface AppContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDark: boolean;
    sidebarOpen: boolean;
    toggleSidebar: (force?: boolean) => void;
    queue: DownloadTask[];
    startDownload: (items: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => void;
    clearCompleted: () => void;
    retryTask: (taskId: string) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isDark, setIsDark] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [queue, setQueue] = useState<DownloadTask[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [totalSpeed, setTotalSpeed] = useState(0);
    const [statusBadgeText, setStatusBadgeText] = useState('Idle');
    const [factorioVersion, setFactorioVersionState] = useState<string>('2.1');

    // Load the saved visual preference before users interact with the theme picker.
    useEffect(() => {
        invoke<string>('get_theme_mode')
            .then(mode => {
                if (mode === 'light' || mode === 'dark' || mode === 'system') {
                    setThemeModeState(mode);
                }
            })
            .catch(() => {});
    }, []);

    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
        invoke('save_theme_mode', { themeMode: mode }).catch(() => {});
    };

    // Load persisted Factorio target version on boot
    useEffect(() => {
        invoke<string>('get_factorio_version')
            .then(ver => {
                if (ver) setFactorioVersionState(ver);
            })
            .catch(() => {});
    }, []);

    const setFactorioVersion = (ver: string) => {
        setFactorioVersionState(ver);
        invoke('save_factorio_version', { version: ver }).catch(() => {});
        addLog(`Explore filter set to Factorio ${ver === 'all' || ver === 'any' ? 'Any Version' : ver}`, 'info');
    };

    // Developer console logger states
    const [logs, setLogs] = useState<LogMessage[]>([
        { id: 'init', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'System active.' }
    ]);
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [completedIds, setCompletedIds] = useState<string[]>([]);

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

    // Handle Theme mode application and tracking
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            const activeDark = themeMode === 'system' ? mediaQuery.matches : themeMode === 'dark';
            setIsDark(activeDark);
            if (activeDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };

        applyTheme();

        if (themeMode === 'system') {
            mediaQuery.addEventListener('change', applyTheme);
            return () => mediaQuery.removeEventListener('change', applyTheme);
        }
    }, [themeMode]);

    const toggleSidebar = (force?: boolean) => setSidebarOpen(prev => force !== undefined ? force : !prev);

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

    const startDownload = (newItems: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => {
        setSidebarOpen(true);
        setStatusBadgeText(type === 'update' ? 'Patching...' : 'Downloading...');
        addLog(`Initiated download queue: ${type === 'update' ? 'Updating' : 'Downloading'} ${newItems.length} mod(s)...`, 'info');

        const initializedItems = newItems.map(item => ({
            ...item,
            progress: 0,
            speed: (Math.random() * 5 + 3).toFixed(1)
        }));

        setQueue(prev => [...prev, ...initializedItems]);
        setIsDownloading(true);
    };

    // Tracking completed tasks for logs
    useEffect(() => {
        queue.forEach(item => {
            if (item.progress >= 100 && !completedIds.includes(item.id)) {
                setCompletedIds(prev => [...prev, item.id]);
                addLog(`Download complete: "${item.name}" (v${item.version}) successfully downloaded.`, 'success');
            }
        });
    }, [queue, completedIds]);

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
                        if (typeof t.status === 'string') {
                            statusTyped = t.status as any;
                        } else if (t.status?.status) {
                            statusTyped = t.status.status as any;
                        }

                        return {
                            id: `${t.id}_${t.version}`,
                            name: t.title || t.id,
                            version: t.version,
                            size: parseFloat(totalMb.toFixed(1)),
                            progress: progress,
                            speed: downloadedMb > 0 ? '4.8' : '0.0',
                            statusType: statusTyped,
                        };
                    });

                    setQueue(formatted);

                    const isAnyActive = tasks.some(t => {
                        const s = typeof t.status === 'string' ? t.status : (t.status?.status || 'pending');
                        return s === 'downloading' || s === 'pending';
                    });

                    setIsDownloading(isAnyActive);
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
            sidebarOpen,
            toggleSidebar,
            queue,
            startDownload,
            clearCompleted,
            retryTask,
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
            setFactorioVersion
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
