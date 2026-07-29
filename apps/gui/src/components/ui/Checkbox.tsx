import React, { useEffect, useRef } from 'react';
import { Check, Minus } from 'lucide-react';
import { LAYER } from '../../theme/layers';

export type CheckboxAccent = 'blue' | 'emerald' | 'amber' | 'sky' | 'violet' | 'teal';

interface CheckboxProps {
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    onChange?: (checked: boolean) => void;
    onClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
    className?: string;
    size?: 'sm' | 'md';
    accent?: CheckboxAccent;
    'aria-label'?: string;
}

const sizeClass = {
    sm: 'w-3.5 h-3.5 rounded-[5px]',
    md: 'w-4 h-4 rounded-md',
} as const;

const iconSizeClass = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
} as const;

const accentClass: Record<CheckboxAccent, { box: string; mark: string }> = {
    blue: {
        box: 'border-blue-400/80 dark:border-blue-500/70 data-[checked=true]:bg-blue-600 data-[checked=true]:border-blue-600 data-[checked=true]:shadow-blue-600/25 dark:data-[checked=true]:bg-blue-500 dark:data-[checked=true]:border-blue-500',
        mark: 'text-white',
    },
    emerald: {
        box: 'border-emerald-400/80 dark:border-emerald-500/70 data-[checked=true]:bg-emerald-600 data-[checked=true]:border-emerald-600 data-[checked=true]:shadow-emerald-600/25 dark:data-[checked=true]:bg-emerald-500 dark:data-[checked=true]:border-emerald-500',
        mark: 'text-white',
    },
    amber: {
        box: 'border-amber-400/80 dark:border-amber-500/70 data-[checked=true]:bg-amber-500 data-[checked=true]:border-amber-500 data-[checked=true]:shadow-amber-500/25 dark:data-[checked=true]:bg-amber-500 dark:data-[checked=true]:border-amber-500',
        mark: 'text-white',
    },
    sky: {
        box: 'border-sky-400/80 dark:border-sky-500/70 data-[checked=true]:bg-sky-600 data-[checked=true]:border-sky-600 data-[checked=true]:shadow-sky-600/25 dark:data-[checked=true]:bg-sky-500 dark:data-[checked=true]:border-sky-500',
        mark: 'text-white',
    },
        violet: {
        box: 'border-violet-400/80 dark:border-violet-500/70 data-[checked=true]:bg-violet-600 data-[checked=true]:border-violet-600 data-[checked=true]:shadow-violet-600/25 dark:data-[checked=true]:bg-violet-500 dark:data-[checked=true]:border-violet-500',
        mark: 'text-white',
    },
    teal: {
        box: 'border-teal-400/80 dark:border-teal-500/70 data-[checked=true]:bg-teal-600 data-[checked=true]:border-teal-600 data-[checked=true]:shadow-teal-600/25 dark:data-[checked=true]:bg-teal-500 dark:data-[checked=true]:border-teal-500',
        mark: 'text-white',
    },
};

export const Checkbox: React.FC<CheckboxProps> = ({
    checked = false,
    indeterminate = false,
    disabled = false,
    readOnly = false,
    onChange,
    onClick,
    className = '',
    size = 'sm',
    accent = 'blue',
    'aria-label': ariaLabel,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isOn = checked || indeterminate;

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    return (
        <label
            className={`relative inline-flex shrink-0 items-center justify-center ${disabled || readOnly ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
            onClick={(e) => {
                // Keep row click handlers from double-toggling when the label is clicked.
                if (!disabled && !readOnly) e.stopPropagation();
            }}
        >
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                readOnly={readOnly}
                aria-label={ariaLabel}
                onClick={onClick}
                onChange={(e) => {
                    if (disabled || readOnly) return;
                    onChange?.(e.target.checked);
                }}
                className="peer sr-only"
            />
            <span
                data-checked={isOn ? 'true' : 'false'}
                aria-hidden="true"
                className={[
                    `pointer-events-none flex items-center justify-center border ${LAYER.contentCard} transition-all duration-150`,
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-zinc-950',
                    'peer-disabled:opacity-55',
                    sizeClass[size],
                    accentClass[accent].box,
                    isOn ? 'shadow-sm' : 'border-slate-300 dark:border-zinc-600',
                    !disabled && !readOnly && !isOn ? 'hover:border-slate-400 dark:hover:border-zinc-500' : '',
                ].join(' ')}
            >
                {indeterminate ? (
                    <Minus className={`${iconSizeClass[size]} ${accentClass[accent].mark} stroke-[3]`} />
                ) : checked ? (
                    <Check className={`${iconSizeClass[size]} ${accentClass[accent].mark} stroke-[3]`} />
                ) : null}
            </span>
        </label>
    );
};
