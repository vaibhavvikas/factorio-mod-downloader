import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { LAYER, BORDER, ACCENT, TEXT, INTERACTIVE, PILL_SIZE } from '../../../theme/layers';


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
    const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const toggleOpen = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;

        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const estimatedHeight = Math.min(280, (versions?.length || 1) * 36 + 12);
            const spaceBelow = window.innerHeight - rect.bottom;

            let top: number | undefined;
            let bottom: number | undefined;

            if (spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight) {
                bottom = Math.round(window.innerHeight - rect.top + 6);
            } else {
                top = Math.round(rect.bottom + 6);
            }

            const minW = compact ? 176 : 220;
            const width = Math.max(minW, Math.round(rect.width));
            const MIN_EDGE = 12;

            const preferredLeft = Math.round(rect.left);
            let left = preferredLeft;

            if (left + width > window.innerWidth - MIN_EDGE) {
                left = Math.round(window.innerWidth - width - MIN_EDGE);
            }

            left = Math.max(MIN_EDGE, left);
            setDropdownPos({ top, bottom, left, width });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative inline-flex items-center shrink-0 select-none">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`panel-pill ${PILL_SIZE.compactMono} gap-1.5 shrink-0 appearance-none leading-none max-w-[300px] transition-colors cursor-pointer disabled:opacity-50 ${LAYER.pillSurface} ${BORDER.tabActive} ${INTERACTIVE.pillHover} ${ACCENT.text}`}
            >
                <span className={`text-[11px] font-bold ${TEXT.muted} shrink-0`}>{label.replace(/:+$/, '')}:</span>
                <span className={`truncate font-mono font-bold ${valueClassName} ${compact ? 'max-w-[180px]' : 'max-w-[240px]'}`}>v{selectedVersion}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${TEXT.muted} ${isOpen ? 'rotate-180' : ''}`} />
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
                        className={`fixed z-[101] ${LAYER.dropdownMenu} ${BORDER.dropdown} rounded-xl shadow-xl overflow-hidden animate-fade-in p-1`}
                        style={{
                            top: dropdownPos.top !== undefined ? `${dropdownPos.top}px` : undefined,
                            bottom: dropdownPos.bottom !== undefined ? `${dropdownPos.bottom}px` : undefined,
                            left: `${dropdownPos.left}px`,
                            width: dropdownPos.width ? `${dropdownPos.width}px` : undefined,
                            minWidth: compact ? '176px' : '220px',
                        }}
                    >
                        <div className="scroller-dropdown scroller-inner max-h-[280px] text-xs font-mono flex flex-col gap-1">
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
                                        className={`px-3 py-2 rounded-md flex items-center justify-start transition-colors cursor-pointer ${isSelected
                                            ? `${ACCENT.menuItemSelected} font-bold`
                                            : `${TEXT.emphasis} ${INTERACTIVE.rowHover}`
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
