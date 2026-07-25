export const LAYER = {
    appCanvas: 'bg-slate-100 dark:bg-zinc-900',
    chromeHeavy: 'bg-slate-50 dark:bg-zinc-950',
    viewportGlass: 'bg-white/80 dark:bg-zinc-800/40',
    viewportHeader: 'bg-slate-100/80 dark:bg-zinc-800/55',
    groupPanel: 'bg-slate-50/90 dark:bg-zinc-800/95',
    contentCard: 'bg-white dark:bg-zinc-800',
    toolbar: 'bg-white dark:bg-zinc-800/95',
    floatingPanel: 'bg-white/95 dark:bg-zinc-950/95',
    heavyPanel: 'bg-white/95 dark:bg-zinc-950',
    innerRecessed: 'bg-slate-100/70 dark:bg-zinc-900/55',
    innerInset: 'bg-slate-100/50 dark:bg-zinc-900/50',
    pillSurface: 'bg-slate-200/60 dark:bg-zinc-900/60',
    summarySurface: 'bg-slate-100/80 dark:bg-zinc-900/50',
} as const;

/* IMPORTANT — BORDER token design (theme-flash-safe):
   Every border token is split into TWO completely-separate logical declarations:
     1. WIDTH + STYLE  →  `border border-solid`
                           Tailwind emits:
                             border-width: 1px;
                             border-style: solid;
     2. COLOR          →  `border-slate-200/90 dark:border-zinc-800/90`
                           Tailwind emits:
                             --tw-border-opacity: 0.9;
                             border-color: rgb(226 232 240 / var(--tw-border-opacity));
                           With dark override:
                             .dark & { --tw-border-opacity:0.9;
                                       border-color: rgb(39 39 42 / var(--tw-border-opacity)); }

   Why split? Because if you write the `border border-slate-200/80` as ONE
   combined utility the browser sometimes applies it as the BORDER SHORTHAND:
     border: 1px solid rgba(226,232,240,0.8);

   When .dark class toggles, Tailwind rewrites the SHORTHAND. Browsers have a
   long-standing bug where a transition declared on `border-color` does NOT
   catch a shorthand `border` declaration change (it only catches the
   longhand). Result = the classic "border holds white (or dark) for the full
   300ms then SNAPS at the last moment" flash you reported. Splitting it
   forces width/style to be stable (no class changes during theme swap) and
   color to be a pure `border-color` property change (caught by transition
   100% of the time). Eliminates flash at the source. */

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
} as const;

export const DIVIDER = {
    /* dividers = border-<side> only (width/style set elsewhere), so pure color
       → always caught cleanly by border-color / border-top-color transition */
    outer: 'border-slate-200/90 dark:border-zinc-800/90',
    inner: 'border-slate-200/60 dark:border-zinc-700/50',
    soft: 'border-slate-200/80 dark:border-zinc-700/80',
} as const;

export const TEXT = {
    secondary: 'text-slate-500 dark:text-zinc-300',
    muted: 'text-slate-400 dark:text-zinc-400',
    dim: 'text-slate-500 dark:text-zinc-400',
} as const;

/* HOVER borders: pure color change only, width/style already set via BORDER.*
   wrapper. Same flash-safe pattern as above. */
export const HOVER_BORDER = {
    card: 'hover:border-slate-300 dark:hover:border-zinc-700',
    cardBright: 'hover:border-slate-300 dark:hover:border-zinc-600/80',
    cardSoft: 'hover:border-slate-300 dark:hover:border-zinc-700/80',
} as const;
