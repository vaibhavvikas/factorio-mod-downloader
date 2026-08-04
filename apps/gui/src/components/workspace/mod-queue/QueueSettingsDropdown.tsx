import React, { useEffect, useRef, useState } from 'react';
import { Settings, ChevronDown, Info, ThumbsUp, Sparkles } from 'lucide-react';
import {
    LAYER,
    BORDER,
    DIVIDER,
    INTERACTIVE,
} from '../../../theme/layers';

interface QueueSettingsDropdownProps {
    autoIncludeRecommended: boolean;
    autoIncludeOptional: boolean;
    onToggleRecommended: (enabled: boolean) => void;
    onToggleOptional: (enabled: boolean) => void;
}

const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (val: boolean) => void;
    ariaLabel?: string;
}> = ({ checked, onChange, ariaLabel }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={(e) => {
                e.stopPropagation();
                onChange(!checked);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-500' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'
                    }`}
            />
        </button>
    );
};

export const QueueSettingsDropdown: React.FC<QueueSettingsDropdownProps> = ({
    autoIncludeRecommended,
    autoIncludeOptional,
    onToggleRecommended,
    onToggleOptional,
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open]);

    return (
        <div ref={containerRef} className="relative inline-flex items-center shrink-0 select-none">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${BORDER.inner} cursor-pointer flex items-center gap-1.5 transition-colors ${open
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                    : `${INTERACTIVE.secondary} text-slate-800 dark:text-zinc-200`
                    }`}
                title="Queue dependency auto-select settings"
                aria-expanded={open}
                aria-haspopup="true"
            >
                <Settings className="w-3.5 h-3.5 text-blue-500" />
                <ChevronDown
                    className={`w-3 h-3 opacity-70 transition-transform duration-200 ${open ? 'rotate-180 text-blue-500' : ''}`}
                />
            </button>

            {open && (
                <div
                    className={`absolute right-0 top-full mt-2 z-50 w-[350px] rounded-lg ${BORDER.dropdown} ${LAYER.floatingPanel} shadow-2xl p-3.5 flex flex-col gap-3 animate-fade-in backdrop-blur-xl`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                            Auto Select Dependencies
                        </h4>
                        <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                            Choose what to add automatically when mods are queued.
                        </p>
                    </div>

                    {/* Option Rows */}
                    <div className="flex flex-col gap-2">
                        {/* Recommended (Default) */}
                        <div
                            onClick={() => onToggleRecommended(!autoIncludeRecommended)}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer select-none ${autoIncludeRecommended
                                ? 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15 dark:border-blue-500/40'
                                : `${LAYER.innerRecessed} ${BORDER.inner} hover:border-slate-400 dark:hover:border-zinc-700`
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${autoIncludeRecommended
                                    ? 'bg-blue-500/20 text-blue-500'
                                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                                    }`}>
                                    <ThumbsUp className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                                            Recommended
                                        </span>
                                        <span className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-1.5 py-0.2 rounded">
                                            Default
                                        </span>
                                    </div>
                                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-snug">
                                        Soft dependencies suggested by mod authors
                                    </span>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={autoIncludeRecommended}
                                onChange={onToggleRecommended}
                                ariaLabel="Toggle recommended dependencies"
                            />
                        </div>

                        {/* Optional */}
                        <div
                            onClick={() => onToggleOptional(!autoIncludeOptional)}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer select-none ${autoIncludeOptional
                                ? 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-500/15 dark:border-purple-500/40'
                                : `${LAYER.innerRecessed} ${BORDER.inner} hover:border-slate-400 dark:hover:border-zinc-700`
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${autoIncludeOptional
                                    ? 'bg-purple-500/20 text-purple-500 dark:text-purple-400'
                                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                                    }`}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                                        Optional
                                    </span>
                                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-snug">
                                        Extra mods that enhance but aren't required
                                    </span>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={autoIncludeOptional}
                                onChange={onToggleOptional}
                                ariaLabel="Toggle optional dependencies"
                            />
                        </div>
                    </div>

                    {/* Footer Info Notice */}
                    <div className={`pt-2.5 mt-0.5 border-t ${DIVIDER.inner} flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 leading-normal`}>
                        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>
                            <strong className="font-semibold text-slate-700 dark:text-zinc-300">Sub-dependencies</strong> only pull required deps to avoid cascade bloat.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
