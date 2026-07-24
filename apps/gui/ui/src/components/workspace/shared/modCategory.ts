const CATEGORY_BADGE_STYLES: Record<string, string> = {
    content: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800/60',
    overhaul: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800/60',
    tweaks: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/60',
    utilities: 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800/60',
    'mod-packs': 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/60',
    scenarios: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800/60',
    localizations: 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800/60',
    internal: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80',
    'no-category': 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700/80',
};

const DEFAULT_CATEGORY_BADGE_STYLE = 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/60';

export interface CategoryPillColors {
    active: string;
    inactive: string;
}

const CATEGORY_PILL_STYLES: Record<string, CategoryPillColors> = {
    all: {
        active: 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
    },
    content: {
        active: 'bg-sky-600 text-white border-sky-600 shadow-xs font-bold',
        inactive: 'bg-sky-500/10 dark:bg-sky-500/25 text-sky-700 dark:text-sky-400 border-sky-500/35 hover:bg-sky-500/20 dark:hover:bg-sky-500/35'
    },
    overhaul: {
        active: 'bg-purple-600 text-white border-purple-600 shadow-xs font-bold',
        inactive: 'bg-purple-500/10 dark:bg-purple-500/25 text-purple-700 dark:text-purple-400 border-purple-500/35 hover:bg-purple-500/20 dark:hover:bg-purple-500/35'
    },
    tweaks: {
        active: 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold',
        inactive: 'bg-amber-500/10 dark:bg-amber-500/25 text-amber-700 dark:text-amber-400 border-amber-500/35 hover:bg-amber-500/20 dark:hover:bg-amber-500/35'
    },
    utilities: {
        active: 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold',
        inactive: 'bg-teal-500/10 dark:bg-teal-500/25 text-teal-700 dark:text-teal-400 border-teal-500/35 hover:bg-teal-500/20 dark:hover:bg-teal-500/35'
    },
    'mod-packs': {
        active: 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold',
        inactive: 'bg-rose-500/10 dark:bg-rose-500/25 text-rose-700 dark:text-rose-400 border-rose-500/35 hover:bg-rose-500/20 dark:hover:bg-rose-500/35'
    },
    scenarios: {
        active: 'bg-orange-600 text-white border-orange-600 shadow-xs font-bold',
        inactive: 'bg-orange-500/10 dark:bg-orange-500/25 text-orange-700 dark:text-orange-400 border-orange-500/35 hover:bg-orange-500/20 dark:hover:bg-orange-500/35'
    },
    localizations: {
        active: 'bg-cyan-600 text-white border-cyan-600 shadow-xs font-bold',
        inactive: 'bg-cyan-500/10 dark:bg-cyan-500/25 text-cyan-700 dark:text-cyan-400 border-cyan-500/35 hover:bg-cyan-500/20 dark:hover:bg-cyan-500/35'
    },
    'no-category': {
        active: 'bg-slate-700 text-white border-slate-700 shadow-xs font-bold',
        inactive: 'bg-slate-500/10 dark:bg-slate-500/25 text-slate-700 dark:text-slate-400 border-slate-500/35 hover:bg-slate-500/20 dark:hover:bg-slate-500/35'
    }
};

export const formatCategoryLabel = (category: string) => (category || 'mod')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

export const getCategoryBadgeStyle = (category: string) =>
    CATEGORY_BADGE_STYLES[(category || '').toLowerCase()] || DEFAULT_CATEGORY_BADGE_STYLE;

export const getCategoryPillStyle = (catId: string, isSelected: boolean): string => {
    const style = CATEGORY_PILL_STYLES[catId] || CATEGORY_PILL_STYLES.all;
    return isSelected ? style.active : style.inactive;
};
