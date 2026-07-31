export const LAYER = {
    appCanvas: 'bg-slate-100 dark:bg-[#0d1117]',
    chromeHeavy: 'bg-slate-50 dark:bg-[#010409]',

    viewportGlass: 'bg-slate-50/80 dark:bg-[#0d1117]/80 backdrop-blur-md',
    navBar: 'bg-slate-50/80 dark:bg-[#161b22]/90 backdrop-blur-md shadow-xs',

    viewportHeader: 'bg-slate-50 dark:bg-[#161b22]',
    groupPanel: 'bg-slate-50 dark:bg-[#161b22]',
    heavyPanel: 'bg-slate-50 dark:bg-[#161b22]',
    listSurface: 'bg-slate-50 dark:bg-[#161b22]',
    viewportFooter: 'bg-slate-50 dark:bg-[#161b22]',

    contentCard: 'bg-slate-50 dark:bg-[#161b22] shadow-sm',
    cardSurface: 'bg-slate-50 dark:bg-[#161b22] shadow-sm',
    toolbar: 'bg-slate-50 dark:bg-[#161b22] shadow-xs',
    floatingPanel: 'bg-slate-50 dark:bg-[#161b22] shadow-xl',
    modalPanel: 'bg-slate-50 dark:bg-[#161b22] shadow-2xl',
    dropdownMenu: 'bg-slate-50 dark:bg-[#161b22] shadow-lg',
    modalBody: 'bg-slate-100 dark:bg-[#0d1117]',

    innerRecessed: 'bg-slate-100 dark:bg-[#010409]',
    innerInset: 'bg-slate-100/80 dark:bg-[#0d1117]/80',
    pillSurface: 'bg-slate-200/80 dark:bg-[#21262d]',
    selectorPill: 'bg-slate-200/80 dark:bg-[#21262d]',
    staticPill: 'bg-slate-100 dark:bg-[#21262d]/60',
    summarySurface: 'bg-slate-100 dark:bg-[#010409]/60',

    navTabActive: 'bg-slate-50 dark:bg-[#161b22] text-blue-600 dark:text-[#58a6ff] border-slate-300 dark:border-[#30363d] font-bold shadow-sm',
    navTabInactive: 'bg-transparent text-slate-600 dark:text-[#8b949e] border-transparent hover:text-slate-900 dark:hover:text-[#f0f6fc] hover:bg-slate-200/50 dark:hover:bg-[#21262d]',
    selectTrigger: 'bg-slate-50 dark:bg-[#21262d] hover:bg-slate-100 dark:hover:bg-[#30363d]',

    tooltipSurface: 'bg-white dark:bg-[#21262d] text-slate-800 dark:text-[#c9d1d9] shadow-md',
    tooltipArrowAbove: 'bg-white dark:bg-[#21262d] border-r border-b border-slate-300 dark:border-[#30363d]',
    tooltipArrowBelow: 'bg-white dark:bg-[#21262d] border-l border-t border-slate-300 dark:border-[#30363d]',

    selectorRow: 'bg-transparent hover:bg-slate-200/60 dark:hover:bg-[#21262d]/70 transition-colors duration-150 cursor-pointer',
    selectorRowActive: 'bg-slate-200/80 dark:bg-[#21262d]',
} as const;

const BW = 'border border-solid';

export const BORDER = {
    outer: `${BW} border-slate-300 dark:border-[#30363d]`,
    card: `${BW} border-slate-200 dark:border-[#30363d]`,
    cardSoft: `${BW} border-slate-200 dark:border-[#30363d]/80`,
    inner: `${BW} border-slate-300 dark:border-[#30363d]`,
    toolbar: `${BW} border-slate-200 dark:border-[#30363d]`,
    pill: `${BW} border-slate-300 dark:border-[#30363d]`,
    tabActive: `border-slate-300 dark:border-[#30363d]`,
    dropdown: `${BW} border-slate-200 dark:border-[#30363d]`,
    tooltip: `${BW} border-slate-300 dark:border-[#30363d]`,
} as const;

export const DIVIDER = {
    outer: 'border-slate-300 dark:border-[#30363d]',
    inner: 'border-slate-200 dark:border-[#21262d]',
    soft: 'border-slate-200 dark:border-[#21262d]',
    line: 'bg-slate-200 dark:bg-[#30363d]',
} as const;

export const TEXT = {
    secondary: 'text-slate-600 dark:text-zinc-300',
    muted: 'text-slate-500 dark:text-zinc-400',
    dim: 'text-slate-400 dark:text-zinc-500',
    primary: 'text-slate-900 dark:text-zinc-100',
    emphasis: 'text-slate-900 dark:text-white',
    hoverEmphasis: 'hover:text-slate-900 dark:hover:text-white',
} as const;

export const ACCENT = {
    icon: 'text-blue-600 dark:text-[#58a6ff]',
    text: 'text-blue-700 dark:text-[#58a6ff]',
    triggerActive: 'bg-blue-100/50 border-blue-300 text-blue-700 dark:bg-[#1f6feb]/20 dark:border-[#388bfd]/40 dark:text-[#58a6ff]',
    menuItemSelected: 'bg-blue-100/60 dark:bg-[#1f6feb]/25 text-blue-700 dark:text-[#58a6ff] hover:bg-blue-200/60 dark:hover:bg-[#1f6feb]/35',
} as const;

export const DEPENDENCY_TYPE = {
    required: {
        label: 'text-blue-700 dark:text-[#58a6ff]',
        icon: 'text-blue-600 dark:text-[#58a6ff]',
        dot: 'bg-blue-600 dark:bg-[#58a6ff]',
    },
    recommended: {
        label: 'text-blue-600 dark:text-[#58a6ff]',
        icon: 'text-blue-600 dark:text-[#58a6ff]',
        dot: 'bg-blue-600 dark:bg-[#58a6ff]',
        rowSelected: 'bg-blue-500/10 dark:bg-[#1f6feb]/20 border-blue-500/30 text-blue-700 dark:text-[#58a6ff] hover:bg-blue-500/20 dark:hover:bg-[#1f6feb]/30 hover:border-blue-500/50',
    },
    optional: {
        label: 'text-slate-600 dark:text-[#8b949e]',
        icon: 'text-slate-500 dark:text-[#6e7681]',
        dot: 'bg-slate-400 dark:bg-[#6e7681]',
        rowSelected: 'bg-slate-200/50 dark:bg-[#21262d] border-slate-300 dark:border-[#30363d] hover:bg-slate-200/80 dark:hover:bg-[#30363d] hover:border-slate-400 dark:hover:border-[#8b949e]',
    },
    incompatible: {
        label: 'text-rose-700 dark:text-[#f85149]',
        icon: 'text-rose-600 dark:text-[#f85149]',
        dot: 'bg-rose-600 dark:bg-[#f85149]',
    },
} as const;

export const HOVER_BORDER = {
    card: 'hover:border-slate-400 dark:hover:border-[#8b949e]/50',
    cardBright: 'hover:border-slate-400 dark:hover:border-[#58a6ff]/60',
    cardSoft: 'hover:border-slate-300 dark:hover:border-[#30363d]',
    pill: 'hover:border-slate-400 dark:hover:border-[#8b949e]/60',
} as const;

export const INTERACTIVE = {
    secondary: 'bg-slate-200/60 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-slate-800 dark:text-[#c9d1d9] transition-colors',
    iconHover: 'hover:bg-slate-200/60 dark:hover:bg-[#21262d] transition-colors',
    rowHover: 'hover:bg-slate-200/70 dark:hover:bg-[#21262d] transition-colors',
    ghostHover: 'hover:bg-slate-200/60 dark:hover:bg-[#21262d] transition-colors',
    navTabHover: 'hover:bg-slate-200/60 dark:hover:bg-[#21262d] transition-colors',
    pillHover: 'hover:bg-slate-300/60 dark:hover:bg-[#30363d] transition-colors',
} as const;

export const ANIMATION = {
    fast: 'transition-all duration-150 ease-out',
    normal: 'transition-all duration-200 ease-out',
    smooth: 'transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)',
    gpu: 'transition-gpu',
    tabPane: 'animate-tab-pane-in',
    subTabPane: 'animate-subtab-pane-in',
    tabButton: 'transition-all duration-200 ease-out active:scale-[0.97]',
    pillPress: 'transition-transform duration-100 active:scale-95',
} as const;

export const PILL_SIZE = {
    compact: 'h-5 min-h-5 max-h-5 px-2.5 rounded-full inline-flex items-center text-[11px]',
    compactMono: 'panel-pill-mono h-5 min-h-5 max-h-5 px-2.5 rounded-full inline-flex items-center text-[11px]',
} as const;
