export const LAYER = {
    appCanvas: 'bg-slate-100 dark:bg-zinc-900',
    chromeHeavy: 'bg-slate-50 dark:bg-zinc-950',
    viewportGlass: 'bg-white/60 dark:bg-zinc-800/40',
    viewportHeader: 'bg-white/70 dark:bg-zinc-800/55',
    groupPanel: 'bg-white dark:bg-zinc-800/95',
    contentCard: 'bg-white dark:bg-zinc-800',
    toolbar: 'bg-white dark:bg-zinc-800/95',
    floatingPanel: 'bg-white/95 dark:bg-zinc-950/95',
    heavyPanel: 'bg-white/95 dark:bg-zinc-950',
    innerRecessed: 'bg-slate-50 dark:bg-zinc-900/55',
    innerInset: 'bg-slate-50/70 dark:bg-zinc-900/50',
    pillSurface: 'bg-slate-100 dark:bg-zinc-900/60',
    summarySurface: 'bg-slate-50 dark:bg-zinc-900/50',
} as const;

export const BORDER = {
    outer: 'border border-slate-200/90 dark:border-zinc-800/90',
    card: 'border border-slate-200/80 dark:border-zinc-700/80',
    cardSoft: 'border border-slate-200/80 dark:border-zinc-700/80',
    inner: 'border border-slate-200/60 dark:border-zinc-700/50',
    toolbar: 'border border-slate-200/90 dark:border-zinc-700/80',
    pill: 'border border-slate-200/60 dark:border-zinc-700/50',
    tabActive: 'border-slate-200/80 dark:border-zinc-700/60',
    dropdown: 'border border-slate-200/80 dark:border-zinc-700/80',
} as const;

export const DIVIDER = {
    outer: 'border-slate-200/90 dark:border-zinc-800/90',
    inner: 'border-slate-200/60 dark:border-zinc-700/50',
    soft: 'border-slate-200/80 dark:border-zinc-700/80',
} as const;

export const TEXT = {
    secondary: 'text-slate-500 dark:text-zinc-300',
    muted: 'text-slate-400 dark:text-zinc-400',
    dim: 'text-slate-500 dark:text-zinc-400',
} as const;

export const HOVER_BORDER = {
    card: 'hover:border-slate-300 dark:hover:border-zinc-700',
    cardBright: 'hover:border-slate-300 dark:hover:border-zinc-600/80',
    cardSoft: 'hover:border-slate-300 dark:hover:border-zinc-700/80',
} as const;
