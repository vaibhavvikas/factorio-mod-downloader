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
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
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
            // Match dropdown width to the trigger button, with a sensible floor so
            // the menu never collapses to a comically narrow size.
            const minW = compact ? 176 : 220;
            const width = Math.max(minW, Math.round(rect.width));
            // RIGHT-ALIGN the dropdown to the button: the chevron lives on the
            // button's right edge, so anchoring the dropdown's right edge there
            // feels visually connected. If the button is wider than minW the
            // dropdown is the same width as the button; if the button is narrower
            // the menu grows to minW and left-shifts without pushing content off
            // the chevron anchor.
            const left = Math.round(rect.right - width);
            setDropdownPos({ top, left, width });
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
                className={`panel-pill panel-pill-mono h-6 min-h-6 max-h-6 px-3 shrink-0 items-center gap-1.5 rounded-full font-semibold text-[10px] max-w-[300px] transition-colors cursor-pointer disabled:opacity-50 ${LAYER.pillSurface} ${BORDER.tabActive}
                    hover:bg-slate-200/70 dark:hover:bg-zinc-900/80 text-indigo-600 dark:text-indigo-400`}
            >
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 shrink-0">{label.replace(/:+$/, '')}:</span>
                <span className={`truncate font-mono font-bold ${valueClassName} ${compact ? 'max-w-[180px]' : 'max-w-[240px]'}`}>v{selectedVersion}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform text-slate-400 dark:text-zinc-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[100] bg-transparent"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsOpen(false);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                    <div
                        className={`fixed z-[101] ${LAYER.contentCard} ${BORDER.toolbar} rounded-xl shadow-xl overflow-hidden animate-fade-in`}
                        style={{
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                            width: dropdownPos.width ? `${dropdownPos.width}px` : undefined,
                            minWidth: compact ? '176px' : '220px',
                        }}
                    >
                        <div className="scroller-dropdown scroller-inner dense max-h-[280px] text-xs font-mono flex flex-col gap-0.5">
                            {versions.map(ver => {
                                const isSelected = ver === selectedVersion;
                                return (
                                    <div
                                        key={ver}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSelect(ver);
                                            setIsOpen(false);
                                        }}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        className={`px-3 py-2 rounded-lg flex items-center justify-start cursor-pointer transition-colors ${isSelected
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
