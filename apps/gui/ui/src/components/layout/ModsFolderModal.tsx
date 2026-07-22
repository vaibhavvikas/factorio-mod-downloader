import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, Check, AlertCircle, FolderSearch, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ModsFolderModalProps {
    isOpen: boolean;
    canCloseOutside?: boolean;
    onClose: () => void;
    onSaveSuccess?: (path: string) => void;
}

export const ModsFolderModal: React.FC<ModsFolderModalProps> = ({
    isOpen,
    canCloseOutside = false,
    onClose,
    onSaveSuccess,
}) => {
    const [modsPath, setModsPath] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            invoke<string | null>('get_mods_folder').then(saved => {
                if (saved) setModsPath(saved);
            }).catch(console.error);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBrowseFolder = async () => {
        try {
            const chosen = await invoke<string | null>('pick_mods_folder_dialog');
            if (chosen) {
                setModsPath(chosen);
            }
        } catch (err: any) {
            console.error('Folder picker error:', err);
        }
    };

    const handleSave = async () => {
        if (!modsPath.trim()) {
            setErrorMsg('Please specify a valid folder path.');
            return;
        }

        setSaving(true);
        setErrorMsg('');

        try {
            await invoke('save_mods_folder', { path: modsPath.trim() });
            if (onSaveSuccess) onSaveSuccess(modsPath.trim());
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.toString() || 'Failed to save configuration.');
        }

        setSaving(false);
    };

    return (
        <div 
            className="absolute top-10 inset-x-0 bottom-0 z-40 flex items-center justify-center bg-black/25 p-4 select-none animate-fade-in"
            onClick={() => {
                if (canCloseOutside) onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div 
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col gap-4 p-6 text-slate-800 dark:text-zinc-100 relative"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                {/* Optional Close X Button if already configured */}
                {canCloseOutside && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Close Modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Folder className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Select Factorio Mods Directory
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                            Specify where downloaded mod files (.zip) will be stored.
                        </p>
                    </div>
                </div>

                {/* Input & Browse Section */}
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                        Mods Folder Location:
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-zinc-200">
                            <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                            <input 
                                type="text"
                                value={modsPath}
                                onChange={(e) => setModsPath(e.target.value)}
                                placeholder="/path/to/factorio/mods"
                                className="bg-transparent border-none focus:outline-none w-full font-mono text-xs text-slate-800 dark:text-zinc-100"
                            />
                        </div>

                        {/* Browse Native Dialog Button */}
                        <button
                            onClick={handleBrowseFolder}
                            className="px-3 py-2 bg-slate-200/80 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer border border-slate-300/60 dark:border-zinc-700/60"
                            title="Browse OS Folder Picker"
                        >
                            <FolderSearch className="w-4 h-4 text-indigo-500" />
                            <span>Browse...</span>
                        </button>
                    </div>

                    {errorMsg && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium mt-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                </div>

                {/* Save Footer Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                    {canCloseOutside && (
                        <button
                            onClick={onClose}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Check className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Confirm & Save'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
