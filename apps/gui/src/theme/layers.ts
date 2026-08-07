export const LAYER = {
    appCanvas: 'bg-slate-100 dark:bg-[#0d1117]',
    chromeHeavy: 'bg-slate-50/78 dark:bg-[#161b22]/78 backdrop-blur-xl backdrop-saturate-150',

    viewportGlass: 'bg-slate-50/80 dark:bg-[#0d1117]/80 backdrop-blur-md',
    navBar: 'bg-slate-50/58 dark:bg-[#161b22]/58 backdrop-blur-xl backdrop-saturate-150 shadow-xs',

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
        label: 'text-sky-700 dark:text-[#7dd3fc]',
        icon: 'text-sky-500 dark:text-sky-400',
        dot: 'bg-sky-500 dark:bg-sky-400',
    },
    recommended: {
        label: 'text-cyan-700 dark:text-[#22d3ee]',
        icon: 'text-cyan-500 dark:text-cyan-400',
        dot: 'bg-cyan-500 dark:bg-cyan-400',
        rowSelected: 'bg-cyan-500/10 dark:bg-[#22d3ee]/20 border-cyan-500/30 text-cyan-700 dark:text-[#22d3ee] hover:bg-cyan-500/20 dark:hover:bg-[#22d3ee]/30 hover:border-cyan-500/50',
    },
    optional: {
        label: 'text-slate-600 dark:text-[#8b949e]',
        icon: 'text-violet-500 dark:text-violet-400',
        dot: 'bg-violet-500 dark:bg-violet-400',
        rowSelected: 'bg-slate-200/50 dark:bg-[#21262d] border-slate-300 dark:border-[#30363d] hover:bg-slate-200/80 dark:hover:bg-[#30363d] hover:border-slate-400 dark:hover:border-[#8b949e]',
    },
    incompatible: {
        label: 'text-rose-700 dark:text-[#f85149]',
        icon: 'text-rose-500 dark:text-rose-400',
        dot: 'bg-rose-500 dark:bg-rose-400',
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
    compact: 'h-6 min-h-6 max-h-6 px-2.5 rounded-md inline-flex items-center justify-center leading-none text-[11px]',
    compactMono: 'panel-pill-mono h-6 min-h-6 max-h-6 px-2.5 rounded-md inline-flex items-center justify-center leading-none text-[11px]',
    comfortable: 'h-6 min-h-6 max-h-6 px-2.5 rounded-md inline-flex items-center justify-center leading-none text-[11px]',
    comfortableMono: 'panel-pill-mono h-6 min-h-6 max-h-6 px-2.5 rounded-md inline-flex items-center justify-center leading-none text-[11px]',
} as const;

export const PILL_TONE = {
    requiredOutline: 'bg-transparent text-sky-600 dark:text-sky-400 border border-sky-500/50 dark:border-sky-400/50',
    recommendedOutline: 'bg-transparent text-blue-600 dark:text-blue-400 border border-blue-500/50 dark:border-blue-400/50',
    optionalOutline: 'bg-transparent text-violet-600 dark:text-violet-400 border border-violet-500/50 dark:border-violet-400/50',
    incompatibleOutline: 'bg-transparent text-rose-600 dark:text-rose-400 border border-rose-500/50 dark:border-rose-400/50',
    content: 'bg-transparent text-sky-600 dark:text-sky-400 border border-sky-500/50 dark:border-sky-400/50',
    overhaul: 'bg-transparent text-purple-600 dark:text-purple-400 border border-purple-500/50 dark:border-purple-400/50',
    tweaks: 'bg-transparent text-amber-600 dark:text-amber-400 border border-amber-500/50 dark:border-amber-400/50',
    utilities: 'bg-transparent text-teal-600 dark:text-teal-400 border border-teal-500/50 dark:border-teal-400/50',
    'mod-packs': 'bg-transparent text-rose-600 dark:text-rose-400 border border-rose-500/50 dark:border-rose-400/50',
    scenarios: 'bg-transparent text-orange-600 dark:text-orange-400 border border-orange-500/50 dark:border-orange-400/50',
    localizations: 'bg-transparent text-cyan-600 dark:text-cyan-400 border border-cyan-500/50 dark:border-cyan-400/50',
    internal: 'bg-transparent text-slate-600 dark:text-slate-400 border border-slate-500/50 dark:border-slate-400/50',
    'no-category': 'bg-transparent text-zinc-600 dark:text-zinc-400 border border-zinc-500/50 dark:border-zinc-400/50',
} as const;

export const CATEGORY_BADGE_STYLES: Record<string, string> = {
    content: 'text-sky-600 dark:text-sky-400 bg-transparent border-sky-500/50 dark:border-sky-400/50',
    overhaul: 'text-purple-600 dark:text-purple-400 bg-transparent border-purple-500/50 dark:border-purple-400/50',
    tweaks: 'text-amber-600 dark:text-amber-400 bg-transparent border-amber-500/50 dark:border-amber-400/50',
    utilities: 'text-teal-600 dark:text-teal-400 bg-transparent border-teal-500/50 dark:border-teal-400/50',
    'mod-packs': 'text-rose-600 dark:text-rose-400 bg-transparent border-rose-500/50 dark:border-rose-400/50',
    scenarios: 'text-orange-600 dark:text-orange-400 bg-transparent border-orange-500/50 dark:border-orange-400/50',
    localizations: 'text-cyan-600 dark:text-cyan-400 bg-transparent border-cyan-500/50 dark:border-cyan-400/50',
    internal: 'text-slate-600 dark:text-slate-400 bg-transparent border-slate-500/50 dark:border-slate-400/50',
    'no-category': 'text-zinc-600 dark:text-zinc-400 bg-transparent border-zinc-500/50 dark:border-zinc-400/50',
};

export const DEFAULT_CATEGORY_BADGE_STYLE = 'text-blue-600 dark:text-blue-400 bg-transparent border-blue-500/50 dark:border-blue-400/50';
