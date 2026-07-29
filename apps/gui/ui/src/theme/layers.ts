export const LAYER = {
    appCanvas: 'bg-slate-100 dark:bg-zinc-900',
    chromeHeavy: 'bg-slate-50 dark:bg-zinc-950',
    viewportGlass: 'bg-slate-200/60 dark:bg-zinc-800/50 backdrop-blur-md',
    viewportHeader: 'bg-slate-100 dark:bg-zinc-900',
    groupPanel: 'bg-slate-100/90 dark:bg-zinc-900/90',
    contentCard: 'bg-white dark:bg-zinc-800',
    cardSurface: 'bg-slate-50 dark:bg-zinc-800/70',
    toolbar: 'bg-white dark:bg-zinc-800/95',
    floatingPanel: 'bg-white/95 dark:bg-zinc-950/95',
    heavyPanel: 'bg-white/95 dark:bg-zinc-950',
    innerRecessed: 'bg-slate-100/70 dark:bg-zinc-900/55',
    innerInset: 'bg-slate-100/50 dark:bg-zinc-900/50',
    pillSurface: 'bg-slate-200/60 dark:bg-zinc-900/60',
    selectorPill: 'bg-slate-200/60 dark:bg-zinc-700',
    staticPill: 'bg-slate-50 dark:bg-zinc-800/50',
    summarySurface: 'bg-slate-100/80 dark:bg-zinc-900/50',
    navBar: 'bg-white/80 dark:bg-zinc-900',
    modalPanel: 'bg-white dark:bg-zinc-900',
    modalBody: 'bg-slate-50 dark:bg-zinc-950/60',
    listSurface: 'bg-white dark:bg-zinc-900/70',
    viewportFooter: 'bg-white/90 dark:bg-zinc-800/95',
    selectTrigger: 'bg-slate-100 dark:bg-zinc-700/60 hover:bg-slate-200/80 dark:hover:bg-zinc-700',
    dropdownMenu: 'bg-white dark:bg-zinc-900',
    tooltipSurface: 'bg-slate-900 dark:bg-zinc-950 text-slate-100 dark:text-zinc-200',
    tooltipArrowAbove: 'bg-slate-900 dark:bg-zinc-950 border-r border-b border-slate-800 dark:border-zinc-800/90',
    tooltipArrowBelow: 'bg-slate-900 dark:bg-zinc-950 border-l border-t border-slate-800 dark:border-zinc-800/90',
} as const;

const BW = 'border border-solid';  /* border-width + style only, never animates */

export const BORDER = {
    outer: `${BW} border-slate-200 dark:border-zinc-800/90`,
    card: `${BW} border-slate-200 dark:border-zinc-700/80`,
    cardSoft: `${BW} border-slate-200/90 dark:border-zinc-700/80`,
    inner: `${BW} border-slate-200/80 dark:border-zinc-700/50`,
    toolbar: `${BW} border-slate-200 dark:border-zinc-700/80`,
    pill: `${BW} border-slate-200/80 dark:border-zinc-700/50`,
    tabActive: `border-slate-200 dark:border-zinc-700/60`,
    dropdown: `${BW} border-slate-200 dark:border-zinc-700/80`,
    tooltip: `${BW} border-slate-800 dark:border-zinc-800/90`,
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
    primary: 'text-slate-900 dark:text-zinc-100',
    emphasis: 'text-slate-800 dark:text-zinc-200',
    hoverEmphasis: 'hover:text-slate-800 dark:hover:text-zinc-200',
} as const;

/** Primary brand / action accent — icons, active triggers, selected menu items */
export const ACCENT = {
    icon: 'text-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    triggerActive: 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-400',
    menuItemSelected: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40',
} as const;

/** Dependency-type colors shared by queue settings, dependency tree, and graph legend */
export const DEPENDENCY_TYPE = {
    required: {
        label: 'text-sky-600 dark:text-sky-400',
        icon: 'text-sky-500 dark:text-sky-400',
        dot: 'bg-sky-500',
    },
    recommended: {
        label: 'text-blue-600 dark:text-blue-400',
        icon: 'text-blue-500 dark:text-blue-400',
        dot: 'bg-blue-500',
        rowSelected: 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-800/50',
    },
    optional: {
        label: 'text-blue-400 dark:text-blue-300',
        icon: 'text-blue-400 dark:text-blue-300',
        dot: 'bg-blue-400',
        rowSelected: 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-800/50',
    },
    incompatible: {
        label: 'text-rose-600 dark:text-rose-400',
        icon: 'text-rose-500 dark:text-rose-400',
        dot: 'bg-rose-500',
    },
} as const;

export const HOVER_BORDER = {
    card: 'hover:border-slate-300 dark:hover:border-zinc-700',
    cardBright: 'hover:border-slate-300 dark:hover:border-zinc-600/80',
    cardSoft: 'hover:border-slate-300 dark:hover:border-zinc-700/80',
    pill: 'hover:border-slate-300 dark:hover:border-zinc-600',
} as const;

export const INTERACTIVE = {
    secondary: 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200',
    iconHover: 'hover:bg-slate-200/60 dark:hover:bg-zinc-800/50',
    rowHover: 'hover:bg-slate-100 dark:hover:bg-zinc-800/80',
    ghostHover: 'hover:bg-slate-100 dark:hover:bg-zinc-800',
    navTabHover: 'hover:bg-slate-100 dark:hover:bg-zinc-800/40',
    pillHover: 'hover:bg-slate-150 dark:hover:bg-zinc-900',
} as const;

export const ANIMATION = {
    fast: 'transition-all duration-150 ease-out',
    normal: 'transition-all duration-200 ease-out',
    smooth: 'transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)',
    gpu: 'transition-gpu',

    // Tab pane switching transitions (cross-platform GPU hardware accelerated)
    tabPane: 'animate-tab-pane-in',
    subTabPane: 'animate-subtab-pane-in',

    // Navigation item & button micro-interactions
    tabButton: 'transition-all duration-200 ease-out active:scale-[0.97]',
    pillPress: 'transition-transform duration-100 active:scale-95',
} as const;
