import React, { createContext, useContext } from 'react';

export interface DownloadTask {
    id: string;
    name: string;
    version: string;
    size: number;
    progress: number;
    speed: string;
    statusType?: 'completed' | 'alreadyExists' | 'updated' | 'downgraded' | 'downloading' | 'pending' | 'failed';
    errorMessage?: string;
}

export interface FactorioVersionOption {
    value: string;
    label: string;
    shortLabel: string;
}

export interface InstalledModItem {
    name: string;
    title: string;
    version: string;
    author?: string;
    factorioVersion?: string;
    minFactorioVersion?: string;
    maxFactorioVersion?: string;
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

export type ThemeMode = 'light' | 'dark' | 'system';
export type ActiveDrawer = 'downloads' | 'settings' | 'profile' | null;

export interface AppContextType {
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
    validFactorioVersions: FactorioVersionOption[];
    setFactorioVersion: (version: string) => void;
    installedMods: InstalledModItem[];
    setInstalledMods: React.Dispatch<React.SetStateAction<InstalledModItem[]>>;
    folderPath: string;
    setFolderPath: (path: string) => void;
    refreshInstalledMods: (customPath?: string) => Promise<void>;
    loadingInstalled: boolean;
    isCheckingUpdates: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const DEFAULT_VERSION_OPTIONS: FactorioVersionOption[] = [
    { value: '2.1', label: 'Factorio 2.1', shortLabel: '2.1' },
    { value: '2.0', label: 'Factorio 2.0', shortLabel: '2.0' },
    { value: '1.1', label: 'Factorio 1.1', shortLabel: '1.1' },
    { value: '1.0', label: 'Factorio 1.0', shortLabel: '1.0' },
    { value: '0.18', label: 'Factorio 0.18', shortLabel: '0.18' },
    { value: '0.17', label: 'Factorio 0.17', shortLabel: '0.17' },
    { value: '0.16', label: 'Factorio 0.16', shortLabel: '0.16' },
    { value: '0.15', label: 'Factorio 0.15', shortLabel: '0.15' },
    { value: '0.14', label: 'Factorio 0.14', shortLabel: '0.14' },
    { value: '0.13', label: 'Factorio 0.13', shortLabel: '0.13' },
    { value: 'any', label: 'Any Version', shortLabel: 'Any' },
];

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within AppProvider");
    return context;
};
