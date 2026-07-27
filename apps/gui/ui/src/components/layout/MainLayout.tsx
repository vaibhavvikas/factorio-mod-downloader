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
import { LAYER, BORDER, TEXT, HOVER_BORDER } from '../../theme/layers';

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
    const { consoleOpen, logs, sidebarOpen, toggleSidebar, profileOpen, setProfileOpen } = useAppContext();
    const consoleEndRef = useRef<HTMLDivElement>(null);
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [configuredModsFolder, setConfiguredModsFolder] = useState<string | null>(null);

    const [latestRelease, setLatestRelease] = useState<{ version: string; url: string; hasUpdate: boolean } | null>(null);

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
        <div className={`h-screen flex flex-col overflow-hidden select-none ${LAYER.appCanvas} text-slate-800 dark:text-zinc-100 relative`}>
            <TitleBar
                onOpenFolderModal={() => setFolderModalOpen(true)}
                configuredModsFolder={configuredModsFolder}
                hasAppUpdate={latestRelease?.hasUpdate || false}
            />

            {/* Main Application Workspace Area */}
            <div className="flex-1 flex overflow-hidden relative min-h-0">
                <Workspace />

                {/* Click-outside backdrop for Download Manager Floating Overlay */}
                {sidebarOpen && (
                    <div
                        className="absolute inset-0 z-30 bg-transparent"
                        onClick={() => toggleSidebar(false)}
                    />
                )}

                {/* Floating Download Manager Overlay */}
                <NetworkSidebar />
            </div>
            <StatusBar />

            {/* Click-outside backdrop shield for Developer Profile */}
            {profileOpen && (
                <div
                    className="absolute inset-0 z-30 bg-transparent"
                    onClick={() => setProfileOpen(false)}
                />
            )}

            {/* Floating Developer Profile Card Overlay */}
            {profileOpen && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute top-11 right-12 z-40 w-84 rounded-2xl ${BORDER.dropdown} ${LAYER.floatingPanel} backdrop-blur-xl shadow-2xl p-4 flex flex-col gap-4 animate-fade-in text-xs max-h-[85vh] overflow-y-auto`}
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
                            <div style={{ display: 'none' }} className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-500 items-center justify-center text-white font-black text-sm shadow-md select-none">
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
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl ${LAYER.pillSurface} ${BORDER.pill} ${HOVER_BORDER.pill} hover:bg-slate-200/80 dark:hover:bg-zinc-800 transition-all text-slate-800 dark:text-zinc-200 font-semibold shadow-2xs`}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-100"
                            >
                                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                                <path d="M9 18c-4.51 2-5-2-7-2" />
                            </svg>
                            <span>GitHub</span>
                        </a>
                        <a
                            href="https://github.com/vaibhavvikas/factorio-mod-downloader/discussions"
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl ${LAYER.pillSurface} ${BORDER.pill} ${HOVER_BORDER.pill} hover:bg-slate-200/80 dark:hover:bg-zinc-800 transition-all text-slate-800 dark:text-zinc-200 font-semibold shadow-2xs`}
                        >
                            <Mail className="w-3.5 h-3.5 text-indigo-500" />
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
                        <div className="flex items-center gap-1.5 font-bold text-[10px] text-indigo-600 dark:text-indigo-400">
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
                            className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-center text-[10.5px] shadow-md shadow-indigo-600/20 border border-indigo-400/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <span>Buy Factorio at Factorio.com</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <p className={`text-[8.5px] leading-tight ${TEXT.muted} mt-0.5`}>
                            Disclaimer: Factorio and all associated game assets, logos, and artwork are registered trademarks of Wube Software. This software is an independent community utility and is not affiliated with or endorsed by Wube Software.
                        </p>
                    </div>
                </div>
            )}

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