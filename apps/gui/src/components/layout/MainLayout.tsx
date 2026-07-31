import React, { useRef, useEffect, useState } from 'react';
import { TitleBar } from './TitleBar';
import { Workspace } from '../workspace/Workspace';
import { NetworkSidebar } from './NetwrokSidebar';
import { StatusBar } from './StatusBar';
import { ModsFolderModal } from './ModsFolderModal';
import { useAppContext } from '../../context/AppContext';
import { Mail, Sparkles, Heart, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { LAYER, BORDER, TEXT, HOVER_BORDER } from '../../theme/layers';

import { SettingsSidebar } from './SettingsSidebar';

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

export function isVersionNewer(onlineVersion: string, currentVersion: string): boolean {
    const clean = (v: string) => v.replace(/^v/i, '').trim();
    const onlineParts = clean(onlineVersion).split('.').map(n => parseInt(n, 10) || 0);
    const currentParts = clean(currentVersion).split('.').map(n => parseInt(n, 10) || 0);

    const maxLen = Math.max(onlineParts.length, currentParts.length);
    for (let i = 0; i < maxLen; i++) {
        const onlineNum = onlineParts[i] || 0;
        const currentNum = currentParts[i] || 0;
        if (onlineNum > currentNum) return true;
        if (onlineNum < currentNum) return false;
    }
    return false;
}

export const MainLayout: React.FC = () => {
    const { consoleOpen, logs, activeDrawer, toggleDrawer, profileOpen } = useAppContext();
    const consoleEndRef = useRef<HTMLDivElement>(null);
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [configuredModsFolder, setConfiguredModsFolder] = useState<string | null>(null);

    const [latestRelease, setLatestRelease] = useState<{ version: string; url: string; hasUpdate: boolean } | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const appWindow = getCurrentWindow();
        const updateMaxed = async () => {
            try {
                const maxed = await appWindow.isMaximized();
                setIsMaximized(maxed);
            } catch (e) {}
        };
        updateMaxed();
        let unlisten: (() => void) | undefined;
        appWindow.onResized(() => updateMaxed()).then(u => { unlisten = u; });
        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Auto-scroll console to bottom on new logs & check Factorio Mods folder on startup
    useEffect(() => {
        if (consoleOpen && consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, consoleOpen]);

    useEffect(() => {
        // First-Use Check: prompt user if mods folder is not configured!
        invoke<string | null>('get_mods_folder').then(saved => {
            if (saved) {
                setConfiguredModsFolder(saved);
            } else {
                setFolderModalOpen(true);
            }
        }).catch(console.error);

        // Compare installed app version (from tauri.conf.json) against latest GitHub release
        Promise.all([
            getVersion(),
            fetch('https://api.github.com/repos/vaibhavvikas/factorio-mod-downloader/releases/latest').then(res => res.json()),
        ])
            .then(([currentVersion, data]) => {
                if (data && data.tag_name) {
                    const tag = data.tag_name.startsWith('v') ? data.tag_name : `v${data.tag_name}`;
                    const hasUpdate = isVersionNewer(tag, currentVersion);
                    setLatestRelease({
                        version: tag,
                        url: data.html_url || 'https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest',
                        hasUpdate
                    });
                }
            })
            .catch(() => {});
    }, []);

    return (
        <div className={`h-screen flex flex-col overflow-hidden select-none ${LAYER.appCanvas} text-slate-800 dark:text-zinc-100 relative ${isMaximized ? (isMac ? 'rounded-xl border border-slate-300/40 dark:border-zinc-800/80 shadow-2xl' : 'rounded-none border-none') : 'rounded-xl border border-slate-300/40 dark:border-zinc-800/80 shadow-2xl'}`}>
            <TitleBar
                configuredModsFolder={configuredModsFolder}
                hasAppUpdate={latestRelease?.hasUpdate || false}
            />

            {/* Main Application Workspace Area */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                <Workspace />

                {/* Click-outside backdrop for Drawers (Downloads / Settings / Profile) */}
                {activeDrawer !== null && (
                    <div
                        className="absolute inset-0 z-30 bg-transparent"
                        onClick={() => toggleDrawer(null)}
                    />
                )}

                {/* Floating Drawer Overlays */}
                <NetworkSidebar />
                <SettingsSidebar />
            </div>
            <StatusBar />

            {/* Floating Developer Profile Card Overlay */}
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{ transform: profileOpen ? 'translateX(0)' : 'translateX(calc(100% + 2rem))' }}
                className={`absolute top-11 right-4 z-40 w-84 rounded-2xl ${BORDER.dropdown} ${LAYER.floatingPanel} backdrop-blur-xl p-4 flex flex-col gap-4 text-xs max-h-[85vh] overflow-y-auto transition-all duration-500 ease-in-out ${profileOpen ? 'opacity-100 shadow-2xl pointer-events-auto' : 'opacity-0 shadow-none pointer-events-none'}`}
            >
                    {/* Avatar & Header */}
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 shrink-0">
                            <img
                                src="https://github.com/vaibhavvikas.png"
                                alt="Vaibhav Vikas"
                                className={`w-10 h-10 rounded-full object-cover ${BORDER.card} shadow-md select-none`}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                            <div style={{ display: 'none' }} className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-rose-500 items-center justify-center text-white font-black text-sm shadow-md select-none">
                                V
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-zinc-50 text-[13px] leading-tight">Vaibhav Vikas</h4>
                            <p className={`text-[10px] ${TEXT.muted} font-mono mt-0.5`}>Factorio Mod Downloader Creator</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className={`${TEXT.secondary} leading-relaxed text-[11px]`}>
                        Hey! I build open-source tools and utilities for gamers. If this tool helped sync your Factorio save sessions, consider starring the repo or supporting the project!
                    </p>

                    {/* Contact Links Grid */}
                    <div className="grid grid-cols-2 gap-2.5 py-0.5 select-none">
                        <a
                            href="https://github.com/vaibhavvikas/factorio-mod-downloader"
                            target="_blank"
                            rel="noreferrer"
                            onClick={async (e) => { e.preventDefault(); await openUrl("https://github.com/vaibhavvikas/factorio-mod-downloader"); }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl ${LAYER.pillSurface} ${BORDER.pill} ${HOVER_BORDER.pill} hover:bg-slate-200/80 dark:hover:bg-zinc-800 transition-all text-slate-800 dark:text-zinc-200 font-semibold shadow-2xs`}
                        >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            <span>GitHub</span>
                        </a>
                        <a
                            href="https://github.com/vaibhavvikas/factorio-mod-downloader/discussions"
                            target="_blank"
                            rel="noreferrer"
                            onClick={async (e) => { e.preventDefault(); await openUrl("https://github.com/vaibhavvikas/factorio-mod-downloader/discussions"); }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl ${LAYER.pillSurface} ${BORDER.pill} ${HOVER_BORDER.pill} hover:bg-slate-200/80 dark:hover:bg-zinc-800 transition-all text-slate-800 dark:text-zinc-200 font-semibold shadow-2xs`}
                        >
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <span>Feedback</span>
                        </a>
                    </div>

                    {/* App Update Available Card — ONLY SHOWN IF A NEWER VERSION EXISTS */}
                    {latestRelease?.hasUpdate && (
                        <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/25 rounded-xl p-3 flex flex-col gap-2 select-none shadow-2xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-[10px] text-amber-600 dark:text-amber-400">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                    <span>UPDATE AVAILABLE</span>
                                </div>
                                <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">{latestRelease.version}</span>
                            </div>
                            <p className={`text-[10.5px] leading-normal ${TEXT.secondary}`}>
                                A new release ({latestRelease.version}) of Factorio Mod Downloader is available!
                            </p>
                            <a
                                href={latestRelease.url}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-center text-[10.5px] shadow-xs shadow-amber-500/20 transition-colors cursor-pointer block"
                            >
                                Update Now
                            </a>
                        </div>
                    )}

                    {/* Official Game & Wube Software Support Section */}
                    <div className={`${LAYER.innerRecessed} ${BORDER.inner} rounded-xl p-3.5 flex flex-col gap-2.5 select-none shadow-2xs`}>
                        <div className="flex items-center gap-1.5 font-bold text-[10px] text-blue-600 dark:text-blue-400">
                            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                            <span>SUPPORT THE DEVELOPERS</span>
                        </div>
                        <p className={`text-[10.5px] leading-relaxed ${TEXT.secondary}`}>
                            Factorio Mod Downloader is an independent open-source tool. If you love playing Factorio, please support the game developers by purchasing the official game!
                        </p>
                        <a
                            href="https://factorio.com/buy"
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 rounded-xl bg-[#1f6feb] hover:bg-[#388bfd] text-white font-bold text-center text-[10.5px] shadow-sm border border-[#1f6feb]/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>Buy Factorio at Factorio.com</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <p className={`text-[8.5px] leading-tight ${TEXT.muted} mt-0.5`}>
                            Disclaimer: Factorio and all associated game assets, logos, and artwork are registered trademarks of Wube Software. This software is an independent community utility and is not affiliated with or endorsed by Wube Software.
                        </p>
                    </div>
                </div>

            {/* Mods Folder Selection Modal */}
            <ModsFolderModal
                isOpen={folderModalOpen}
                canCloseOutside={!!configuredModsFolder}
                onClose={() => setFolderModalOpen(false)}
                onSaveSuccess={(p) => setConfiguredModsFolder(p)}
            />
        </div>
    );
};