import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { LAYER, BORDER } from '../../../theme/layers';

export interface VersionDropdownProps {
    versions: string[];
    selectedVersion: string;
    onSelect: (ver: string) => void;
    disabled?: boolean;
    label?: string;
    valueClassName?: string;
    compact?: boolean;
}

export const InstalledVersionDropdown: React.FC<VersionDropdownProps> = ({
    versions,
    selectedVersion,
    onSelect,
    disabled,
    label = 'Ver:',
    valueClassName = '',
    compact = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleOpen = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;

        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 280;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight
                ? rect.top - dropdownHeight - 6
                : rect.bottom + 6;
            setDropdownPos({ top, left: rect.left });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative select-none">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`flex items-center gap-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-mono font-bold ${
                    compact
                        ? `${LAYER.pillSurface} ${BORDER.tabActive} text-[11px] px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900/90 max-w-[300px]`
                        : `${LAYER.pillSurface} ${BORDER.tabActive} text-[11px] px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900/90 max-w-[300px]`
                }`}
            >
                <span className="text-[9px] text-slate-400 font-normal shrink-0">{label}</span>
                <span className={`truncate ${valueClassName} ${compact ? 'max-w-[180px]' : 'max-w-[240px]'}`}>v{selectedVersion}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => setIsOpen(false)} />
                    <div
                        className={`fixed z-[101] ${compact ? 'w-56' : 'w-64'} ${LAYER.contentCard} ${BORDER.toolbar} rounded-xl shadow-xl overflow-hidden animate-fade-in`}
                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    >
                        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-700/50 text-xs font-mono">
                            {versions.map(ver => {
                                const isSelected = ver === selectedVersion;
                                return (
                                    <div
                                        key={ver}
                                        onClick={() => {
                                            onSelect(ver);
                                            setIsOpen(false);
                                        }}
                                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold'
                                                : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700/80'
                                        }`}
                                    >
                                        <span>v{ver}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
