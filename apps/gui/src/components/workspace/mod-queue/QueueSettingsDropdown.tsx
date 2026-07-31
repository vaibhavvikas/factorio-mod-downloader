import React, { useEffect, useRef, useState } from 'react';
import { Settings, ChevronDown, Info } from 'lucide-react';
import { Checkbox } from '../../ui/Checkbox';
import {
    LAYER,
    BORDER,
    DIVIDER,
    TEXT,
    INTERACTIVE,
    ACCENT,
    DEPENDENCY_TYPE,
} from '../../../theme/layers';

interface QueueSettingsDropdownProps {
    autoIncludeRecommended: boolean;
    autoIncludeOptional: boolean;
    onToggleRecommended: (enabled: boolean) => void;
    onToggleOptional: (enabled: boolean) => void;
}

const SETTING_ROWS = [
    {
        key: 'recommended' as const,
        label: 'Recommended',
        description: 'Soft dependencies suggested by mod authors',
        accent: 'blue' as const,
        style: DEPENDENCY_TYPE.recommended,
        locked: false,
    },
    {
        key: 'optional' as const,
        label: 'Optional',
        description: 'Extra mods that enhance but are not needed',
        accent: 'blue' as const,
        style: DEPENDENCY_TYPE.optional,
        locked: false,
    },
];

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

    const checkedByKey = {
        required: true,
        recommended: autoIncludeRecommended,
        optional: autoIncludeOptional,
    };

    const toggleByKey = {
        recommended: onToggleRecommended,
        optional: onToggleOptional,
    };

    return (
        <div ref={containerRef} className="relative shrink-0 select-none">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${open
                        ? 'bg-slate-200 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 hover:bg-slate-300/70 dark:hover:bg-zinc-700'
                        : `${INTERACTIVE.secondary} ${BORDER.inner}`
                    }`}
                title="Queue dependency auto-select settings"
                aria-expanded={open}
                aria-haspopup="true"
            >
                <Settings className="w-3.5 h-3.5" />
                <ChevronDown
                    className={`w-3 h-3 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div
                    className={`absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl ${BORDER.dropdown} ${LAYER.dropdownMenu} shadow-xl p-3 flex flex-col gap-2 animate-fade-in`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className={`pb-2 border-b ${DIVIDER.inner}`}>
                        <p className={`text-[11px] font-bold ${TEXT.primary}`}>
                            Auto-select on add
                        </p>
                        <p className={`text-[10px] ${TEXT.muted} mt-0.5 leading-normal`}>
                            Default checks when mods enter the queue
                        </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {SETTING_ROWS.map((row) => {
                            const checked = checkedByKey[row.key];
                            const isLocked = row.locked;
                            const rowSelectedClass =
                                row.key === 'recommended'
                                    ? DEPENDENCY_TYPE.recommended.rowSelected
                                    : row.key === 'optional'
                                        ? DEPENDENCY_TYPE.optional.rowSelected
                                        : '';

                            const rowContent = (
                                <>
                                    <Checkbox
                                        checked={checked}
                                        disabled={isLocked}
                                        readOnly={isLocked}
                                        onChange={
                                            !isLocked
                                                ? (next) => toggleByKey[row.key as 'recommended' | 'optional'](next)
                                                : undefined
                                        }
                                        accent={row.accent}
                                        size="sm"
                                        className="mt-0.5"
                                        aria-label={
                                            isLocked
                                                ? 'Required dependencies always included'
                                                : `Auto-select ${row.label} dependencies`
                                        }
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <span className={`text-[11px] font-bold ${row.style.label}`}>
                                            {row.label}
                                        </span>
                                        <span className={`text-[10px] ${TEXT.secondary} leading-snug`}>
                                            {row.description}
                                        </span>
                                    </div>
                                    {isLocked && (
                                        <span className={`text-[9px] font-semibold uppercase tracking-wide shrink-0 ${TEXT.muted} mt-0.5`}>
                                            Always on
                                        </span>
                                    )}
                                </>
                            );

                            if (isLocked) {
                                return (
                                    <div
                                        key={row.key}
                                        className={`${LAYER.innerRecessed} ${BORDER.inner} rounded-lg px-2.5 py-2 flex items-start gap-2.5 cursor-default`}
                                    >
                                        {rowContent}
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={row.key}
                                    type="button"
                                    onClick={() =>
                                        toggleByKey[row.key as 'recommended' | 'optional'](!checked)
                                    }
                                    className={`w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-2.5 transition-colors cursor-pointer border ${checked
                                        ? rowSelectedClass
                                        : `${LAYER.listSurface} ${BORDER.inner} ${INTERACTIVE.rowHover}`
                                        }`}
                                >
                                    {rowContent}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        className={`${LAYER.innerRecessed} ${BORDER.inner} rounded-lg px-2.5 py-2 flex items-start gap-2 text-[10px] leading-relaxed ${TEXT.secondary}`}
                    >
                        <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${ACCENT.icon}`} />
                        <span>
                            <span className={`font-semibold ${TEXT.emphasis}`}>
                                Sub-dependencies
                            </span>{' '}
                            only pull required deps to avoid cascade bloat.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
