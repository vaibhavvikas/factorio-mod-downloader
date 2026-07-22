import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface DownloadTask {
    id: string;
    name: string;
    version: string;
    size: number;
    progress: number;
    speed: string;
}

export interface LogMessage {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'success' | 'error';
    message: string;
}

interface AppContextType {
    themeMode: 'light' | 'dark' | 'system';
    setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
    isDark: boolean;
    sidebarOpen: boolean;
    toggleSidebar: (force?: boolean) => void;
    queue: DownloadTask[];
    startDownload: (items: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => void;
    clearCompleted: () => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
    const [isDark, setIsDark] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [queue, setQueue] = useState<DownloadTask[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [totalSpeed, setTotalSpeed] = useState(0);
    const [statusBadgeText, setStatusBadgeText] = useState('Idle');

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
    const clearCompleted = () => setQueue(prev => prev.filter(q => q.progress < 100));

    const startDownload = (newItems: Omit<DownloadTask, 'progress' | 'speed'>[], type: 'update' | 'download') => {
        setSidebarOpen(true);
        setStatusBadgeText(type === 'update' ? 'Patching...' : 'Downloading...');
        addLog(`Initiated network task: ${type === 'update' ? 'Updating' : 'Installing'} ${newItems.length} items.`, 'info');

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
                addLog(`Mod sync completed: "${item.name}" (v${item.version}) successfully installed.`, 'success');
            }
        });
    }, [queue, completedIds]);

    // Simulated Download Engine
    useEffect(() => {
        if (!isDownloading) return;

        const interval = setInterval(() => {
            setQueue(prevQueue => {
                let activeCount = 0;
                let currentSpeed = 0;

                const updatedQueue = prevQueue.map(item => {
                    if (item.progress >= 100) return item;

                    activeCount++;
                    const step = (parseFloat(item.speed) / item.size) * 100 * 0.45;
                    const newProgress = Math.min(100, item.progress + step);
                    let newSpeed = parseFloat(item.speed) + (Math.random() - 0.5) * 0.5;
                    if (newSpeed < 1) newSpeed = 1.8;

                    currentSpeed += newSpeed;
                    return { ...item, progress: newProgress, speed: newSpeed.toFixed(1) };
                });

                setTotalSpeed(currentSpeed);

                if (activeCount === 0) {
                    setIsDownloading(false);
                    setStatusBadgeText('All Complete');
                    setTotalSpeed(0);
                    addLog('All queued mod file synchronizations completed successfully.', 'success');
                }

                return updatedQueue;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [isDownloading]);

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
            isDownloading,
            totalSpeed,
            statusBadgeText,
            logs,
            addLog,
            clearLogs,
            consoleOpen,
            setConsoleOpen,
            profileOpen,
            setProfileOpen
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