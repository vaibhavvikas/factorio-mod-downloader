import React, { useRef, useEffect, useState } from 'react';
import { TitleBar } from './TitleBar';
import { Workspace } from '../workspace/Workspace';
import { NetworkSidebar } from './NetwrokSidebar';
import { StatusBar } from './StatusBar';
import { ModsFolderModal } from './ModsFolderModal';
import { useAppContext } from '../../context/AppContext';
import { Mail, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const MainLayout: React.FC = () => {
    const { consoleOpen, logs, sidebarOpen, toggleSidebar, profileOpen, setProfileOpen } = useAppContext();
    const consoleEndRef = useRef<HTMLDivElement>(null);
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [configuredModsFolder, setConfiguredModsFolder] = useState<string | null>(null);

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
    }, []);

    return (
        <div className="h-screen flex flex-col overflow-hidden select-none bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl relative">
            <TitleBar 
                onOpenFolderModal={() => setFolderModalOpen(true)}
                configuredModsFolder={configuredModsFolder}
            />
            <div className="flex-1 flex overflow-hidden relative">
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
                    className="absolute top-11 right-12 z-40 w-72 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-2xl flex flex-col gap-4 animate-fade-in text-xs"
                >
                    {/* Avatar & Header */}
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 shrink-0">
                            <img 
                                src="https://github.com/vaibhavvikas.png" 
                                alt="Vaibhav Vikas" 
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-zinc-800 shadow-md select-none"
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
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">Factorio Mod Downloader Creator</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Hey! I build open-source tools and utilities for gamers. If this tool helped sync your Factorio save sessions, consider donating to support the project!
                    </p>

                    {/* Contact Links Grid */}
                    <div className="grid grid-cols-2 gap-2.5 py-1 select-none">
                        <a 
                            href="https://github.com/vaibhavvikas" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-250 hover:bg-slate-50 dark:border-zinc-800/80 dark:hover:bg-zinc-900 transition-colors text-slate-700 dark:text-zinc-300 font-semibold"
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
                            href="mailto:contact@example.com" 
                            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-250 hover:bg-slate-50 dark:border-zinc-800/80 dark:hover:bg-zinc-900 transition-colors text-slate-700 dark:text-zinc-300 font-semibold"
                        >
                            <Mail className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Email</span>
                        </a>
                    </div>

                    {/* Divider Line */}
                    <div className="border-t border-slate-200/50 dark:border-zinc-800/60 my-0.5" />

                    {/* App Update Available Card */}
                    <div className="bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex flex-col gap-2 select-none">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-[10px] text-amber-600 dark:text-amber-400">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                <span>UPDATE AVAILABLE</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-zinc-800/40">v0.7.0</span>
                        </div>
                        <p className="text-[10.5px] leading-normal text-slate-600 dark:text-zinc-400">
                            A new stable version of Factorio Mod Downloader is available! Update to access the latest features.
                        </p>
                        <button 
                            onClick={() => alert("Launching browser to download latest release...")}
                            className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-center text-[10.5px] shadow-sm shadow-amber-500/20 transition-colors cursor-pointer border-none"
                        >
                            Update Now
                        </button>
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