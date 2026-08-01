import { CATEGORY_BADGE_STYLES, DEFAULT_CATEGORY_BADGE_STYLE } from '../../../theme/layers';

export interface CategoryPillColors {
    active: string;
    inactive: string;
}

const CATEGORY_PILL_STYLES: Record<string, CategoryPillColors> = {
    all: {
        active: 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    content: {
        active: 'bg-sky-600 text-white border-sky-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    overhaul: {
        active: 'bg-purple-600 text-white border-purple-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    tweaks: {
        active: 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    utilities: {
        active: 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    'mod-packs': {
        active: 'bg-rose-600 text-white border-rose-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    scenarios: {
        active: 'bg-orange-600 text-white border-orange-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    localizations: {
        active: 'bg-cyan-600 text-white border-cyan-600 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
    },
    'no-category': {
        active: 'bg-slate-700 text-white border-slate-700 shadow-xs font-bold',
        inactive: 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-50 dark:hover:bg-zinc-700/60'
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
