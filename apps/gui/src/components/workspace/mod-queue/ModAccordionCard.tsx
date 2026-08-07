import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MinusCircle, ExternalLink, Calendar, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { DependencyTree } from './DependencyTree';
import type { TreeNode } from './DependencyTree';
import { formatCategoryLabel, getCategoryPillTone } from '../shared/modCategory';
import { useAppContext } from '../../../context/AppContext';
import { LAYER, BORDER, DIVIDER, HOVER_BORDER, TEXT, ACCENT, INTERACTIVE, PILL_SIZE, PILL_TONE } from '../../../theme/layers';
import { compareVersions } from '../../../utils/versionUtils';
import { Tooltip } from '../../ui/Tooltip';

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
    const [dropdownPos, setDropdownPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });

    const formatVer = (ver?: string) => {
        if (!ver || !ver.trim()) return '';
        const v = ver.trim();
        return v.startsWith('v') ? v : `v${v}`;
    };

    const { factorioVersion } = useAppContext();
    const filteredReleases = availableReleases.filter(rel => {
        if (!factorioVersion || factorioVersion === 'all' || factorioVersion === 'any') return true;
        if (!rel.factorio_version) return true;
        const cleanRel = rel.factorio_version.trim();
        const cleanTarget = factorioVersion.trim();
        return cleanRel === cleanTarget || cleanRel.startsWith(cleanTarget) || cleanTarget.startsWith(cleanRel);
    });
    const displayReleases = filteredReleases.length > 0 ? filteredReleases : availableReleases;

    const currentRelease = displayReleases.find(r => r.version === selectedVersion) || availableReleases.find(r => r.version === selectedVersion);
    const displayLabel = currentRelease && currentRelease.factorio_version
        ? `${formatVer(currentRelease.version)} (Factorio ${currentRelease.factorio_version})`
        : formatVer(selectedVersion);

    const handleToggle = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const estimatedHeight = Math.min(280, (displayReleases?.length || 1) * 36 + 12);
            const spaceBelow = window.innerHeight - rect.bottom;

            let top: number | undefined;
            let bottom: number | undefined;

            if (spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight) {
                bottom = Math.round(window.innerHeight - rect.top + 6);
            } else {
                top = Math.round(rect.bottom + 6);
            }

            const width = Math.max(200, Math.round(rect.width));
            const MIN_EDGE = 12;

            const preferredLeft = Math.round(rect.left);
            let left = preferredLeft;

            if (left + width > window.innerWidth - MIN_EDGE) {
                left = Math.round(window.innerWidth - width - MIN_EDGE);
            }

            left = Math.max(MIN_EDGE, left);

            setDropdownPos({ top, bottom, left, width });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative inline-flex items-center shrink-0 select-none">

            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`panel-pill ${PILL_SIZE.compactMono} gap-1.5 shrink-0 appearance-none leading-none ${LAYER.pillSurface} ${BORDER.pill} ${INTERACTIVE.pillHover} ${ACCENT.text} font-semibold transition-all cursor-pointer max-w-[320px]`}
            >
                <span className={`${TEXT.muted} shrink-0`}>Ver:</span>
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
                        className={`fixed z-[101] ${LAYER.dropdownMenu} ${BORDER.dropdown} rounded-xl shadow-xl overflow-hidden animate-fade-in p-1`}
                        style={{
                            top: dropdownPos.top !== undefined ? `${dropdownPos.top}px` : undefined,
                            bottom: dropdownPos.bottom !== undefined ? `${dropdownPos.bottom}px` : undefined,
                            left: `${dropdownPos.left}px`,
                            width: dropdownPos.width ? `${dropdownPos.width}px` : undefined,
                            minWidth: '200px',
                        }}
                    >
                        <div className="scroller-dropdown scroller-inner max-h-[280px] text-xs font-mono flex flex-col gap-1">
                            {displayReleases && displayReleases.length > 0 ? (
                                displayReleases.map(rel => {
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
                                            className={`px-3 py-2 rounded-md flex items-center justify-between transition-colors gap-3 cursor-pointer ${isSelected
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
    const { installedMods, factorioVersion } = useAppContext();
    const installed = installedMods.find(m => m.name === mod.name);

    const isCardIncompatible = !!(factorioVersion && factorioVersion !== 'all' && factorioVersion !== 'any' && mod.availableReleases && mod.availableReleases.length > 0 && !mod.availableReleases.some(rel => {
        if (!rel.factorio_version) return true;
        const cleanRel = rel.factorio_version.trim();
        const cleanTarget = factorioVersion.trim();
        return cleanRel === cleanTarget || cleanRel.startsWith(cleanTarget) || cleanTarget.startsWith(cleanRel);
    }));

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

    const [isRemoving, setIsRemoving] = useState(false);

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRemoving(true);
        setTimeout(() => {
            onRemove(mod.id);
        }, 350);
    };

    const lettersOnly = (mod.title || mod.name || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const initialLetter = lettersOnly ? lettersOnly[0].toUpperCase() : 'M';
    const categoryPillTone = getCategoryPillTone(mod.category);

    return (
        <div className={`w-full ${LAYER.cardSurface} ${BORDER.card} rounded-md shadow-xs ${isCardIncompatible ? 'hover:border-rose-400 dark:hover:border-rose-500/60' : HOVER_BORDER.cardBright} hover:shadow-md transition-all duration-200 ${isRemoving ? 'item-dismissing' : 'animate-fade-in'} overflow-hidden`}>
            {/* Sticky Header — pins to top of scroll container like VS Code sticky scroll */}
            <div className={`p-4 flex flex-col gap-3 sticky top-0 z-10 ${LAYER.cardSurface} rounded-t-lg`}>
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
                            <div className={`w-10 h-10 rounded-xl ${LAYER.pillSurface} ${BORDER.card} shadow-inner shrink-0 mt-0.5 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-zinc-200 uppercase select-none`}>
                                {initialLetter}
                            </div>
                        )}

                        <div className="flex flex-col min-w-0">
                            {/* Mod Title (Primary Display) */}
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-50 truncate">
                                    {mod.title || mod.name}
                                </h3>
                                {/* Category Badge */}
                                {mod.category && (
                                    <span className={`panel-pill ${PILL_SIZE.compact} shrink-0 tracking-wide border ${categoryPillTone}`}>
                                    {formatCategoryLabel(mod.category)}
                                </span>
                                )}
                            </div>

                            {/* Author & Release Information */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 overflow-hidden font-sans select-none">
                                <span className="truncate">
                                    by <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{mod.author || 'Unknown'}</strong>
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
                                <span className="truncate min-w-0 text-slate-700 dark:text-zinc-300 font-semibold">
                                    {mod.name}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons: Mod Portal Link + Minus Icon (Neutral Style) */}
                    <div className="flex shrink-0 items-center gap-1">
                        <Tooltip content="Open on Mod Portal">
                            <a
                                href={`https://mods.factorio.com/mod/${mod.name}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={async (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    await openUrl(`https://mods.factorio.com/mod/${mod.name}`);
                                }}
                                aria-label={`Open ${mod.title || mod.name} on the Factorio Mod Portal`}
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-blue-400 cursor-pointer block"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </Tooltip>

                        <Tooltip content="Remove from queue">
                            <button
                                onClick={handleRemove}
                                className="rounded-md p-1.5 border transition-colors cursor-pointer bg-transparent text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-200/60 dark:hover:bg-zinc-800 shrink-0"
                                aria-label="Remove from queue"
                            >
                                <MinusCircle className="h-3.5 w-3.5" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Incompatibility Warning Panel */}
                {isCardIncompatible && (
                    <div className={`flex items-start gap-2.5 ${LAYER.summarySurface} p-2.5 rounded-xl ${BORDER.inner}`}>
                        <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                            The selected mod version is incompatible with Factorio {factorioVersion}. No supported release is available.
                        </span>
                    </div>
                )}

                {/* Mod Summary if available */}
                {mod.summary && (
                    <>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed m-0 p-0">
                            {mod.summary}
                        </p>
                        <div className={`border-b ${DIVIDER.inner}`} />
                    </>
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

                        {installed && (() => {
                            if (isCardIncompatible) {
                                return (
                                    <span className={`panel-pill ${PILL_SIZE.compactMono} bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 font-semibold select-none`}>
                                        Installed: v{installed.version} (Incompatible)
                                    </span>
                                );
                            }
                            const cmp = compareVersions(mod.selectedVersion, installed.version);
                            if (cmp === 0) {
                                return (
                                    <span className={`panel-pill ${PILL_SIZE.compactMono} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-semibold select-none`}>
                                        Installed: v{installed.version}
                                    </span>
                                );
                            } else if (cmp > 0) {
                                return (
                                    <span className={`panel-pill ${PILL_SIZE.compactMono} bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 font-semibold gap-1 select-none`}>
                                        <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                        <span>Installed: v{installed.version} (Upgrade)</span>
                                    </span>
                                );
                            } else {
                                return (
                                    <span className={`panel-pill ${PILL_SIZE.compactMono} bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 font-semibold gap-1 select-none`}>
                                        <ArrowDown className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>Installed: v{installed.version} (Downgrade)</span>
                                    </span>
                                );
                            }
                        })()}

                        {/* Dep count badges */}
                        {!isCardIncompatible && requiredCount > 0 && (
                            <span className={`panel-pill ${PILL_SIZE.compactMono} ${PILL_TONE.requiredOutline} select-none`}>
                                {requiredCount} Required
                            </span>
                        )}
                        {!isCardIncompatible && recommendedNodes.length > 0 && (
                            <span className={`panel-pill ${PILL_SIZE.compactMono} ${PILL_TONE.recommendedOutline} select-none`}>
                                {recommendedSelected}/{recommendedNodes.length} Recommended
                            </span>
                        )}
                        {!isCardIncompatible && optionalNodes.length > 0 && (
                            <span className={`panel-pill ${PILL_SIZE.compactMono} ${PILL_TONE.optionalOutline} select-none`}>
                                {optionalSelected}/{optionalNodes.length} Optional
                            </span>
                        )}
                    </div>

                    {/* Expand/Collapse toggle — clean icon button */}
                    <button
                        onClick={toggleExpanded}
                        disabled={!hasDependencies}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors select-none ${hasDependencies
                            ? `${TEXT.secondary} hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer`
                            : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-50'
                            }`}
                    >
                        <span>{expanded ? 'Hide' : 'Show'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Section-wise Dependency List Section — smooth animated expand/collapse */}
            <div className={`accordion-collapse ${expanded ? 'expanded' : ''}`}>
                <div className="accordion-collapse-inner">
                    <div
                        className={`px-4 pb-4 pt-2 ${LAYER.innerRecessed} border-t ${DIVIDER.inner} flex flex-col gap-3 transition-transform duration-300 ease-out`}
                        style={{ transform: expanded ? 'translateY(0)' : 'translateY(-6px)' }}
                    >
                        <DependencyTree
                            nodes={mod.dependencies}
                            selectedDepIds={mod.selectedDepIds}
                            onToggleDep={(depId) => onToggleDep(mod.id, depId)}
                            onToggleSection={(type, selectAll) => onToggleSection(mod.id, type, selectAll)}
                            disabled={isCardIncompatible}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
