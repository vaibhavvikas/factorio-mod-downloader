import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, Trash2, ExternalLink, Calendar } from 'lucide-react';
import { DependencyTree } from './DependencyTree';
import type { TreeNode } from './DependencyTree';
import { formatCategoryLabel, getCategoryBadgeStyle } from '../shared/modCategory';
import { useAppContext } from '../../../context/AppContext';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT, ACCENT, INTERACTIVE } from '../../../theme/layers';

export interface ModVersionRelease {
    version: string;
    factorio_version?: string;
    released_at?: string;
    dependencies: {
        required: { id: string; ineq: string; version: string }[];
        recommended: { id: string; ineq: string; version: string }[];
        optional: { id: string; ineq: string; version: string }[];
        incompatible: { id: string; ineq: string; version: string }[];
    };
}

export interface TargetModItem {
    id: string;
    name: string;
    title: string;
    author: string;
    category: string;
    summary: string;
    thumbnail?: string;
    updatedAt?: string;
    downloadsCount: number;
    selectedVersion: string;
    availableReleases: ModVersionRelease[];
    selectedDepIds: string[];
    dependencies: TreeNode[];
}

interface CustomVersionDropdownProps {
    selectedVersion: string;
    availableReleases: ModVersionRelease[];
    onSelectVersion: (version: string) => void;
}

const CustomVersionDropdown: React.FC<CustomVersionDropdownProps> = ({
    selectedVersion,
    availableReleases,
    onSelectVersion,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

    const formatVer = (ver?: string) => {
        if (!ver || !ver.trim()) return '';
        const v = ver.trim();
        return v.startsWith('v') ? v : `v${v}`;
    };

    const currentRelease = availableReleases.find(r => r.version === selectedVersion);
    const displayLabel = currentRelease && currentRelease.factorio_version
        ? `${formatVer(currentRelease.version)} (Factorio ${currentRelease.factorio_version})`
        : formatVer(selectedVersion);

    const handleToggle = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 280; // max-h-[280px]
            const spaceBelow = window.innerHeight - rect.bottom;
            let top: number;
            if (spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight) {
                // Not enough space below — flip upward
                top = rect.top - dropdownHeight - 6;
            } else {
                // Default — open downward
                top = rect.bottom + 6;
            }
            // Match dropdown width to its trigger button with a sensible floor.
            const width = Math.max(256, Math.round(rect.width));
            const MIN_EDGE = 12; // always keep 12px from any viewport edge
            const maxLeft = Math.max(MIN_EDGE, window.innerWidth - width - MIN_EDGE);

            // Preferred placement: RIGHT-ALIGN to the button's chevron edge
            // (same as the Installed→Updates version dropdown for consistent UX).
            const preferredLeft = Math.round(rect.right - width);

            // If preferred placement would go off-screen LEFT (button near the
            // left edge of a panel), flip to LEFT-ANCHOR alignment so the
            // dropdown grows to the right instead of clipping on the left.
            const leftAnchorLeft = Math.round(rect.left);

            let left = preferredLeft;
            if (preferredLeft < MIN_EDGE) {
                left = Math.min(leftAnchorLeft, maxLeft);
            }

            left = Math.min(left, maxLeft);
            left = Math.max(MIN_EDGE, left);

            setDropdownPos({ top, left, width });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative select-none">

            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`panel-pill panel-pill-mono px-3 h-6.5 min-h-6.5 rounded-lg border flex items-center gap-1.5 shrink-0 ${LAYER.pillSurface} ${BORDER.pill} ${INTERACTIVE.pillHover} ${ACCENT.text} text-[11px] font-mono font-bold transition-all cursor-pointer shadow-2xs max-w-[320px]`}
            >
                <span className={`text-[10px] font-bold ${TEXT.muted} shrink-0 font-sans`}>Ver:</span>
                <span className="truncate max-w-[240px]">{displayLabel}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${TEXT.muted} ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[100] bg-transparent"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsOpen(false);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                    <div
                        className={`fixed z-[101] ${LAYER.dropdownMenu} ${BORDER.dropdown} rounded-xl shadow-xl overflow-hidden animate-fade-in`}
                        style={{
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                            width: dropdownPos.width ? `${dropdownPos.width}px` : undefined,
                            minWidth: '256px',
                        }}
                    >
                        <div className="scroller-dropdown scroller-inner dense max-h-[280px] text-xs font-mono flex flex-col gap-0.5">
                            {availableReleases && availableReleases.length > 0 ? (
                                availableReleases.map(rel => {
                                    const isSelected = rel.version === selectedVersion;
                                    return (
                                        <div
                                            key={rel.version}
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onSelectVersion(rel.version);
                                                setIsOpen(false);
                                            }}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors gap-3 ${isSelected
                                                ? `${ACCENT.menuItemSelected} font-bold`
                                                : `${TEXT.emphasis} ${INTERACTIVE.rowHover}`
                                                }`}
                                        >
                                            <span className="min-w-0 truncate">{formatVer(rel.version)}</span>
                                            {rel.factorio_version && (
                                                <span className={`text-[10px] ${TEXT.muted} shrink-0`}>Factorio {rel.factorio_version}</span>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className={`px-3 py-2 ${TEXT.emphasis} font-bold`}>
                                    {formatVer(selectedVersion)}
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

interface ModAccordionCardProps {
    mod: TargetModItem;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onToggleDep: (modId: string, depId: string) => void;
    onToggleSection: (modId: string, type: 'recommended' | 'optional', selectAll: boolean) => void;
    onSelectVersion: (id: string, version: string) => void;
    onRemove: (id: string) => void;
}

export const ModAccordionCard: React.FC<ModAccordionCardProps> = ({
    mod,
    isExpanded,
    onToggleExpand,
    onToggleDep,
    onToggleSection,
    onSelectVersion,
    onRemove,
}) => {
    const [localExpanded, setLocalExpanded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const { installedMods } = useAppContext();
    const installed = installedMods.find(m => m.name === mod.name);

    const expanded = isExpanded !== undefined ? isExpanded : localExpanded;
    const toggleExpanded = onToggleExpand || (() => setLocalExpanded(!localExpanded));

    // Per-section counts for collapsed summary
    const requiredCount = mod.dependencies.filter(n => n.type === 'required').length;
    const recommendedNodes = mod.dependencies.filter(n => n.type === 'recommended');
    const optionalNodes = mod.dependencies.filter(n => n.type === 'optional');
    const recommendedSelected = recommendedNodes.filter(n => mod.selectedDepIds.includes(n.id)).length;
    const optionalSelected = optionalNodes.filter(n => mod.selectedDepIds.includes(n.id)).length;
    const hasDependencies = mod.dependencies.length > 0;

    // Format updated date (e.g., "Jun 25, 2026")
    const formattedUpdateDate = mod.updatedAt
        ? new Date(mod.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    const lettersOnly = (mod.title || mod.name || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const initialLetter = lettersOnly ? lettersOnly[0].toUpperCase() : 'M';
    const categoryBadgeStyle = getCategoryBadgeStyle(mod.category);

    return (
        <div className={`${LAYER.cardSurface} ${BORDER.card} rounded-2xl shadow-xs ${HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200 overflow-hidden`}>
            {/* Sticky Header — pins to top of scroll container like VS Code sticky scroll */}
            <div className={`p-4 flex flex-col gap-3 sticky top-0 z-10 ${LAYER.cardSurface} rounded-t-2xl`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 overflow-hidden">
                        {/* Mod Thumbnail image with initial letter fallback */}
                        {mod.thumbnail && !imgError ? (
                            <img
                                src={mod.thumbnail}
                                alt={mod.title}
                                className={`w-10 h-10 rounded-xl object-cover ${BORDER.card} shadow-sm shrink-0 mt-0.5`}
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 dark:bg-blue-500/25 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shrink-0 mt-0.5 select-none shadow-xs">
                                {initialLetter}
                            </div>
                        )}

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {mod.title || mod.name}
                                </h3>
                                <span className={`shrink truncate whitespace-nowrap text-[11px] font-mono ${TEXT.secondary} ${LAYER.pillSurface} px-2 py-0.5 rounded-md ${BORDER.pill}`} title={mod.name}>
                                    {mod.name}
                                </span>
                                <span className={`panel-pill tracking-wide border ${categoryBadgeStyle}`}>
                                    {formatCategoryLabel(mod.category)}
                                </span>
                            </div>
                            <div className={`flex items-center gap-2.5 text-xs ${TEXT.secondary} mt-1 flex-wrap`}>
                                <span>by <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{mod.author || 'Author'}</strong></span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Download className="w-3 h-3 text-slate-400" />
                                    {(mod.downloadsCount || 0).toLocaleString()} downloads
                                </span>
                                {formattedUpdateDate && (
                                    <>
                                        <span>•</span>
                                        <span className={`flex items-center gap-1 ${TEXT.secondary}`}>
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            Updated: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{formattedUpdateDate}</strong>
                                        </span>
                                    </>
                                )}
                                <span>•</span>
                                <a
                                    href={`https://mods.factorio.com/mod/${mod.name}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-500 hover:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer font-medium"
                                >
                                    <span>Portal</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Remove button — top right */}
                    <button
                        onClick={() => onRemove(mod.id)}
                        className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove target mod"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Mod Summary if available */}
                {mod.summary && (
                    <p className={`text-xs text-slate-600 dark:text-zinc-400 leading-relaxed ${LAYER.summarySurface} p-2.5 rounded-xl ${BORDER.inner}`}>
                        {mod.summary}
                    </p>
                )}

                {/* Bottom bar: Version selector + Dep badges + Expand toggle — always visible */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Version Dropdown */}
                        <CustomVersionDropdown
                            selectedVersion={mod.selectedVersion}
                            availableReleases={mod.availableReleases}
                            onSelectVersion={(v) => onSelectVersion(mod.id, v)}
                        />

                        {installed && (
                            installed.version === mod.selectedVersion ? (
                                <span className="panel-pill panel-pill-mono bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold text-[10px] select-none">
                                    Installed: v{installed.version}
                                </span>
                            ) : (
                                <span className="panel-pill panel-pill-mono bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 font-semibold text-[10px] select-none">
                                    Installed: v{installed.version} (Update Available)
                                </span>
                            )
                        )}

                        {/* Separator */}
                        {hasDependencies && (
                            <span className="text-slate-200 dark:text-zinc-700 select-none">|</span>
                        )}

                        {/* Dep count badges — always visible with desaturated dark mode colors */}
                        {requiredCount > 0 && (
                            <span className="panel-pill panel-pill-mono bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 select-none">
                                {requiredCount} required
                            </span>
                        )}
                        {recommendedNodes.length > 0 && (
                            <span className="panel-pill panel-pill-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 select-none">
                                {recommendedSelected}/{recommendedNodes.length} recommended
                            </span>
                        )}
                        {optionalNodes.length > 0 && (
                            <span className="panel-pill panel-pill-mono bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60 select-none">
                                {optionalSelected}/{optionalNodes.length} optional
                            </span>
                        )}
                    </div>

                    {/* Expand/Collapse toggle — clean icon button */}
                    <button
                        onClick={toggleExpanded}
                        disabled={!hasDependencies}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors select-none ${hasDependencies
                            ? `${TEXT.secondary} hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer`
                            : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-50'
                            }`}
                        title={hasDependencies ? "Toggle Dependencies List" : "No dependencies for this version"}
                    >
                        <span>{expanded ? 'Hide' : 'Show'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Section-wise Dependency List Section — smooth animated expand/collapse */}
            <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                style={{
                    gridTemplateRows: expanded ? '1fr' : '0fr',
                    opacity: expanded ? 1 : 0,
                }}
            >
                <div className="overflow-hidden">
                    <div
                        className={`px-4 pb-4 pt-2 ${LAYER.innerRecessed} border-t ${DIVIDER.inner} flex flex-col gap-3 transition-transform duration-300 ease-in-out`}
                        style={{ transform: expanded ? 'translateY(0)' : 'translateY(-8px)' }}
                    >
                        <DependencyTree
                            nodes={mod.dependencies}
                            selectedDepIds={mod.selectedDepIds}
                            onToggleDep={(depId) => onToggleDep(mod.id, depId)}
                            onToggleSection={(type, selectAll) => onToggleSection(mod.id, type, selectAll)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
