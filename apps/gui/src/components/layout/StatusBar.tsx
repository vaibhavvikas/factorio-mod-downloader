import React, { useState, useEffect } from 'react';
import { Terminal, Gamepad2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getVersion } from '@tauri-apps/api/app';
import { LAYER, DIVIDER, TEXT, ACCENT } from '../../theme/layers';
import { Tooltip } from '../ui/Tooltip';

export const StatusBar: React.FC = () => {
    const { queue, logs, consoleOpen, setConsoleOpen, isDownloading, totalSpeed, factorioVersion, toggleDrawer } = useAppContext();
    const lastLog = logs[logs.length - 1];
    const [appVersion, setAppVersion] = useState('');

    useEffect(() => {
        getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion(''));
    }, []);

    const remainingItems = queue.filter(q => q.progress < 100).length;
    const completedItems = queue.length - remainingItems;

    const getFactorioVersionLabel = (ver: string) => {
        switch (ver) {
            case '2.1': return 'Factorio 2.1';
            case '2.0': return 'Factorio 2.0';
            case '1.1': return 'Factorio 1.1';
            case '1.0': return 'Factorio 1.0';
            case '0.18': return 'Factorio 0.18';
            case '0.17': return 'Factorio 0.17';
            case '0.16': return 'Factorio 0.16';
            case '0.15': return 'Factorio 0.15';
            case '0.14': return 'Factorio 0.14';
            case '0.13': return 'Factorio 0.13';
            case 'all':
            case 'any': return 'Any Factorio';
            default: return `Factorio ${ver}`;
        }
    };

    return (
        <div className={`h-8 ${LAYER.chromeHeavy} border-t ${DIVIDER.outer} flex items-center justify-between px-3 shrink-0 text-xs font-medium ${TEXT.muted} transition-colors select-none`}>
            <div className="flex items-center gap-4 overflow-hidden flex-1 mr-4">
                <Tooltip content="Click to toggle system logs panel" className="flex-1 min-w-0">
                    <button
                        onClick={() => setConsoleOpen(!consoleOpen)}
                        className={`flex items-center gap-2 ${TEXT.hoverEmphasis} transition-colors cursor-pointer text-left truncate w-full`}
                    >
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                        </span>
                        <Terminal className={`w-3.5 h-3.5 ${ACCENT.icon} shrink-0`} />
                        <span className={`font-mono text-xs truncate ${TEXT.secondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}>
                            {lastLog ? lastLog.message : 'System active.'}
                        </span>
                    </button>
                </Tooltip>
            </div>

            <div className="flex items-center gap-3 shrink-0">

                {queue.length > 0 ? (
                    <div className={`flex items-center gap-1.5 ${TEXT.muted} select-none`}>
                        {isDownloading ? (
                            <>
                                <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                <span className="text-xs">Syncing: <strong className={`font-mono font-bold ${TEXT.primary}`}>{completedItems}/{queue.length}</strong> ({totalSpeed.toFixed(1)} MB/s)</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">ALL SYNCED</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div className={`flex items-center gap-1.5 ${TEXT.muted} select-none`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider">READY</span>
                    </div>
                )}

                {/* Selected Factorio Game Version Badge with hover effect */}
                <span className={`${TEXT.dim} opacity-40 select-none`}>|</span>
                <button
                    onClick={() => toggleDrawer('settings')}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-700 dark:hover:text-blue-300 transition-all cursor-pointer select-none font-mono text-xs font-bold"
                >
                    <Gamepad2 className={`w-3.5 h-3.5 ${ACCENT.icon} shrink-0`} />
                    <span>{getFactorioVersionLabel(factorioVersion)}</span>
                </button>

                {/* Dynamic app version from tauri.conf.json */}
                {appVersion && (
                    <>
                        <span className={`${TEXT.dim} opacity-40 select-none`}>|</span>
                        <span className={`text-xs font-mono ${TEXT.secondary} font-bold select-none`}>v{appVersion}</span>
                    </>
                )}
            </div>
        </div>
    );
};

