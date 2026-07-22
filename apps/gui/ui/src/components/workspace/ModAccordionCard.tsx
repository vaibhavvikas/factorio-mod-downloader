import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Trash2, ExternalLink, Calendar } from 'lucide-react';
import { DependencyTree } from './DependencyTree';
import type { TreeNode } from './DependencyTree';

export interface ModVersionRelease {
    version: string;
    factorio_version: string;
    released_at?: string;
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

    const formatVer = (ver?: string) => {
        if (!ver || !ver.trim()) return '';
        const v = ver.trim();
        return v.startsWith('v') ? v : `v${v}`;
    };

    const currentRelease = availableReleases.find(r => r.version === selectedVersion);
    const displayLabel = currentRelease 
        ? `${formatVer(currentRelease.version)} (Factorio ${currentRelease.factorio_version})` 
        : formatVer(selectedVersion);

    return (
        <div className="relative z-30">
            {isOpen && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-950 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
                <span className="text-[10px] text-slate-400 font-normal">Ver:</span>
                <span>{displayLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Floating Selection Window Capped at 10 items max height (max-h-[280px]) */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-fade-in">
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
                                        <span className="text-[10px] text-slate-400">Factorio {rel.factorio_version}</span>
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
            )}
        </div>
    );
};

interface ModAccordionCardProps {
    mod: TargetModItem;
    onToggleDep: (modId: string, depId: string) => void;
    onToggleSection: (modId: string, type: 'recommended' | 'optional', selectAll: boolean) => void;
    onSelectVersion: (id: string, version: string) => void;
    onRemove: (id: string) => void;
}

export const ModAccordionCard: React.FC<ModAccordionCardProps> = ({
    mod,
    onToggleDep,
    onToggleSection,
    onSelectVersion,
    onRemove,
}) => {
    const [expanded, setExpanded] = useState(true);
    const [imgError, setImgError] = useState(false);

    const countActiveDeps = (nodes: TreeNode[]): number => {
        let count = 0;
        nodes.forEach(n => {
            if (n.isShared) return;
            if (mod.selectedDepIds.includes(n.id)) count++;
            if (n.children) count += countActiveDeps(n.children);
        });
        return count;
    };

    const activeDepCount = countActiveDeps(mod.dependencies);

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

    return (
        <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl shadow-sm transition-all overflow-hidden">
            {/* Main Header / Top Section */}
            <div className="p-4 flex flex-col gap-3">
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
                                <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-zinc-700/60">
                                    {mod.name}
                                </span>
                                <span className="text-[9.5px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                                    {mod.category || 'mod'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
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

                        {/* Dep count badges — always visible */}
                        {requiredCount > 0 && (
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 select-none">
                                {requiredCount} required
                            </span>
                        )}
                        {recommendedNodes.length > 0 && (
                            <span className="text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 select-none">
                                {recommendedSelected}/{recommendedNodes.length} recommended
                            </span>
                        )}
                        {optionalNodes.length > 0 && (
                            <span className="text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/60 select-none">
                                {optionalSelected}/{optionalNodes.length} optional
                            </span>
                        )}
                    </div>

                    {/* Expand/Collapse toggle — clean icon button */}
                    <button
                        onClick={() => setExpanded(!expanded)}
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
