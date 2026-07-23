import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, Trash2, ExternalLink, Calendar } from 'lucide-react';
import { DependencyTree } from './DependencyTree';
import type { TreeNode } from './DependencyTree';
import { formatCategoryLabel, getCategoryBadgeStyle } from './modCategory';

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
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    const formatVer = (ver?: string) => {
        if (!ver || !ver.trim()) return '';
        const v = ver.trim();
        return v.startsWith('v') ? v : `v${v}`;
    };

    const currentRelease = availableReleases.find(r => r.version === selectedVersion);
    const displayLabel = currentRelease && currentRelease.factorio_version
        ? `${formatVer(currentRelease.version)} (Factorio ${currentRelease.factorio_version})` 
        : formatVer(selectedVersion);

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 280; // max-h-[280px]
            const spaceBelow = window.innerHeight - rect.bottom;
            
            if (spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight) {
                // Not enough space below — flip upward
                setDropdownPos({ top: rect.top - dropdownHeight - 6, left: rect.left });
            } else {
                // Default — open downward
                setDropdownPos({ top: rect.bottom + 6, left: rect.left });
            }
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-950 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer max-w-[300px]"
                title={displayLabel}
            >
                <span className="text-[10px] text-slate-400 font-normal shrink-0">Ver:</span>
                <span className="truncate max-w-[240px]">{displayLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Portal-rendered dropdown — escapes sticky/overflow-hidden ancestors */}
            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => setIsOpen(false)} />
                    <div 
                        className="fixed z-[101] w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-fade-in"
                        style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    >
                        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs font-mono">
                            {availableReleases && availableReleases.length > 0 ? (
                                availableReleases.map(rel => {
                                    const isSelected = rel.version === selectedVersion;
                                    return (
                                        <div
                                            key={rel.version}
                                            onClick={() => {
                                                onSelectVersion(rel.version);
                                                setIsOpen(false);
                                            }}
                                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold' 
                                                    : 'text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            <span>{formatVer(rel.version)}</span>
                                            {rel.factorio_version && (
                                                <span className="text-[10px] text-slate-400">Factorio {rel.factorio_version}</span>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="px-3 py-2 text-slate-700 dark:text-zinc-200 font-bold">
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

    const expanded = isExpanded !== undefined ? isExpanded : localExpanded;
    const toggleExpanded = onToggleExpand || (() => setLocalExpanded(!localExpanded));

    // Per-section counts for collapsed summary
    const requiredCount = mod.dependencies.filter(n => n.type === 'required').length;
    const recommendedNodes = mod.dependencies.filter(n => n.type === 'recommended');
    const optionalNodes = mod.dependencies.filter(n => n.type === 'optional');
    const recommendedSelected = recommendedNodes.filter(n => mod.selectedDepIds.includes(n.id)).length;
    const optionalSelected = optionalNodes.filter(n => mod.selectedDepIds.includes(n.id)).length;

    // Format updated date (e.g., "Jun 25, 2026")
    const formattedUpdateDate = mod.updatedAt 
        ? new Date(mod.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    const initialLetter = (mod.title || mod.name || 'M').charAt(0).toUpperCase();
    const categoryBadgeStyle = getCategoryBadgeStyle(mod.category);

    return (
        <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl shadow-xs hover:border-slate-300 dark:hover:border-zinc-700/80 hover:shadow-md transition-all duration-200 overflow-hidden">
            {/* Sticky Header — pins to top of scroll container like VS Code sticky scroll */}
            <div className="p-4 flex flex-col gap-3 sticky top-0 z-10 bg-white dark:bg-zinc-900/90 rounded-t-2xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 overflow-hidden">
                        {/* Mod Thumbnail image with initial letter fallback */}
                        {mod.thumbnail && !imgError ? (
                            <img 
                                src={mod.thumbnail} 
                                alt={mod.title}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0 mt-0.5"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-base shrink-0 mt-0.5 select-none shadow-xs">
                                {initialLetter}
                            </div>
                        )}

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {mod.title || mod.name}
                                </h3>
                                <span className="max-w-[150px] shrink truncate whitespace-nowrap text-xs font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-zinc-700/60" title={mod.name}>
                                    {mod.name}
                                </span>
                                <span className={`panel-pill tracking-wide border ${categoryBadgeStyle}`}>
                                    {formatCategoryLabel(mod.category)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
                                <span>by <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{mod.author || 'Author'}</strong></span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Download className="w-3 h-3 text-slate-400" />
                                    {(mod.downloadsCount || 0).toLocaleString()} downloads
                                </span>
                                {formattedUpdateDate && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
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
                                    className="text-indigo-500 hover:text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer font-medium"
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
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove target mod"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>

                {/* Mod Summary if available */}
                {mod.summary && (
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-zinc-950/40 p-2.5 rounded-xl border border-slate-200/50 dark:border-zinc-800/50">
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

                        {/* Separator */}
                        <span className="text-slate-200 dark:text-zinc-800 select-none">|</span>

                        {/* Dep count badges — always visible with desaturated dark mode colors */}
                        {requiredCount > 0 && (
                            <span className="panel-pill panel-pill-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300/90 border border-emerald-200/60 dark:border-emerald-800/40 select-none">
                                {requiredCount} required
                            </span>
                        )}
                        {recommendedNodes.length > 0 && (
                            <span className="panel-pill panel-pill-mono bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300/90 border border-indigo-200/60 dark:border-indigo-800/40 select-none">
                                {recommendedSelected}/{recommendedNodes.length} recommended
                            </span>
                        )}
                        {optionalNodes.length > 0 && (
                            <span className="panel-pill panel-pill-mono bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300/80 border border-amber-200/60 dark:border-amber-800/30 select-none">
                                {optionalSelected}/{optionalNodes.length} optional
                            </span>
                        )}
                    </div>

                    {/* Expand/Collapse toggle — clean icon button */}
                    <button
                        onClick={toggleExpanded}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer select-none"
                        title="Toggle Dependencies List"
                    >
                        <span>{expanded ? 'Hide' : 'Show'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Section-wise Dependency List Section — smooth animated expand/collapse */}
            <div 
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-2 bg-slate-50/60 dark:bg-zinc-950/60 border-t border-slate-100 dark:border-zinc-800/60 flex flex-col gap-3">
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
