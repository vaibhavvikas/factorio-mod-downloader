import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { LAYER, BORDER, TEXT, ACCENT, INTERACTIVE } from '../../theme/layers';

export interface FactorioVersionDropdownProps {
    value?: string;
    onChange?: (val: string) => void;
}

export const FactorioVersionDropdown: React.FC<FactorioVersionDropdownProps> = ({
    value: customValue,
    onChange: customOnChange,
}) => {
    const { factorioVersion, setFactorioVersion, validFactorioVersions } = useAppContext();
    const value = customValue !== undefined ? customValue : factorioVersion;
    const onChange = customOnChange || setFactorioVersion;

    const versionList = validFactorioVersions.map(opt => ({
        value: opt.value,
        label: opt.shortLabel
    }));

    const [open, setOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const activeItem = versionList.find(v => v.value === value) || versionList[0] || { value: '2.1', label: '2.1' };

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const width = Math.max(192, Math.round(rect.width));
            const MIN_EDGE = 12;
            const top = Math.round(rect.bottom + 6);

            const preferredLeft = Math.round(rect.left);
            let left = preferredLeft;

            if (left + width > window.innerWidth - MIN_EDGE) {
                left = Math.round(window.innerWidth - width - MIN_EDGE);
            }

            left = Math.max(MIN_EDGE, left);
            setDropdownPos({ top, left, width });
        }
        setOpen(!open);
    };

    return (
        <div className="relative inline-flex items-center shrink-0 select-none">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className={`flex h-9 items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-bold appearance-none leading-none ${LAYER.selectTrigger} ${BORDER.inner} hover:border-blue-500/50 transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 shadow-2xs`}
                title="Filter mods by target Factorio version"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs shrink-0" role="img" aria-label="Game Controller">🎮</span>
                    <span className={`text-xs font-semibold ${TEXT.secondary} shrink-0`}>Factorio Version:</span>
                    <span className={`font-bold ${ACCENT.text} truncate font-mono text-xs`}>{activeItem.label}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 ${TEXT.muted} shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[100] bg-transparent"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div
                        className={`fixed z-[101] rounded-xl ${BORDER.dropdown} ${LAYER.dropdownMenu} shadow-xl backdrop-blur-md max-h-60 scroller-dropdown overflow-y-auto animate-fade-in p-2 flex flex-col gap-1`}
                        style={{
                            top: `${dropdownPos.top}px`,
                            left: `${dropdownPos.left}px`,
                            width: dropdownPos.width ? `${dropdownPos.width}px` : '192px',
                        }}
                    >
                        {versionList.map((item) => {
                            const isSelected = value === item.value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(item.value);
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-2 text-xs rounded-md transition-colors cursor-pointer text-left ${isSelected
                                            ? `${ACCENT.menuItemSelected} font-bold`
                                            : `${TEXT.emphasis} ${INTERACTIVE.rowHover}`
                                        }`}
                                >
                                    <span className="font-mono">{item.label}</span>
                                    {isSelected && <Check className={`w-3.5 h-3.5 ${ACCENT.text}`} />}
                                </button>
                            );
                        })}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
