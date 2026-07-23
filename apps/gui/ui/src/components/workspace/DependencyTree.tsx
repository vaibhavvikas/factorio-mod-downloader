import React from 'react';
import { Layers } from 'lucide-react';

export type DependencyType = 'required' | 'recommended' | 'optional' | 'incompatible';

export interface TreeNode {
    id: string;
    name: string;
    version: string;
    size: number;
    type: DependencyType;
    isShared?: boolean;
    sharedWith?: string;
    children?: TreeNode[];
}

interface DependencyTreeProps {
    nodes: TreeNode[];
    selectedDepIds: string[];
    onToggleDep: (depId: string) => void;
    onToggleSection: (type: 'recommended' | 'optional', selectAll: boolean) => void;
}

export const DependencyTree: React.FC<DependencyTreeProps> = ({
    nodes,
    selectedDepIds,
    onToggleDep,
    onToggleSection,
}) => {
    if (!nodes || nodes.length === 0) {
        return (
            <div className="text-center py-4 text-xs text-slate-400 dark:text-zinc-600 font-mono">
                No dependencies listed for this version.
            </div>
        );
    }

    const requiredNodes = nodes.filter(n => n.type === 'required');
    const recommendedNodes = nodes.filter(n => n.type === 'recommended');
    const optionalNodes = nodes.filter(n => n.type === 'optional');
    const incompatibleNodes = nodes.filter(n => n.type === 'incompatible');

    // Section 2: Recommended Calculation
    const recommendedSelectedCount = recommendedNodes.filter(n => selectedDepIds.includes(n.id)).length;
    const isAllRecommendedSelected = recommendedNodes.length > 0 && recommendedSelectedCount === recommendedNodes.length;
    const isSomeRecommendedSelected = recommendedSelectedCount > 0 && !isAllRecommendedSelected;

    // Section 3: Optional Calculation
    const optionalSelectedCount = optionalNodes.filter(n => selectedDepIds.includes(n.id)).length;
    const isAllOptionalSelected = optionalNodes.length > 0 && optionalSelectedCount === optionalNodes.length;
    const isSomeOptionalSelected = optionalSelectedCount > 0 && !isAllOptionalSelected;

    const formatVersionLabel = (ver?: string) => {
        if (!ver || !ver.trim()) return null;
        const v = ver.trim();
        return v.startsWith('v') ? v : `v${v}`;
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Section 1: Required Dependencies */}
            {requiredNodes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-emerald-600 dark:text-emerald-300 select-none">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={true} 
                                disabled 
                                readOnly 
                                className="w-3.5 h-3.5 rounded border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-500 cursor-not-allowed opacity-80" 
                            />
                            <span>Required Dependencies ({requiredNodes.length})</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Always Included</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl divide-y divide-slate-100 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
                        {requiredNodes.map(node => (
                            <div key={node.id} className="flex items-center justify-between p-2.5 text-xs select-none cursor-default bg-slate-50/30 dark:bg-zinc-900/40">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <input 
                                        type="checkbox" 
                                        checked={true} 
                                        disabled 
                                        readOnly 
                                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-zinc-700 text-emerald-600 cursor-not-allowed opacity-80" 
                                    />
                                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                    {formatVersionLabel(node.version) && (
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{formatVersionLabel(node.version)}</span>
                                    )}
                                    {node.isShared && (
                                        <span className="flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                                            <Layers className="w-2.5 h-2.5 text-indigo-400" />
                                            shared
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section 2: Recommended Dependencies */}
            {recommendedNodes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div 
                        onClick={() => onToggleSection('recommended', !isAllRecommendedSelected)}
                        className="flex items-center justify-between px-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={isAllRecommendedSelected}
                                ref={el => { if (el) el.indeterminate = isSomeRecommendedSelected; }}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleSection('recommended', !isAllRecommendedSelected);
                                }}
                                className="w-3.5 h-3.5 rounded border-indigo-400 text-indigo-600 cursor-pointer" 
                            />
                            <span>Recommended Dependencies ({recommendedSelectedCount}/{recommendedNodes.length})</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl divide-y divide-slate-100 dark:divide-zinc-800/60 overflow-hidden shadow-2xs ">
                        {recommendedNodes.map(node => {
                            const isSelected = selectedDepIds.includes(node.id);
                            return (
                                <div 
                                    key={node.id} 
                                    onClick={() => onToggleDep(node.id)}
                                    className={`flex items-center justify-between p-2.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors ${!isSelected ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => onToggleDep(node.id)}
                                            className="w-3.5 h-3.5 rounded border-indigo-400 text-indigo-600 cursor-pointer" 
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                        {formatVersionLabel(node.version) && (
                                            <span className="text-[10px] font-mono text-slate-400">{formatVersionLabel(node.version)}</span>
                                        )}
                                        {node.isShared && (
                                            <span className="flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                                                <Layers className="w-2.5 h-2.5 text-indigo-400" />
                                                shared
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Section 3: Optional Dependencies */}
            {optionalNodes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div 
                        onClick={() => onToggleSection('optional', !isAllOptionalSelected)}
                        className="flex items-center justify-between px-1 text-xs font-bold text-amber-600 dark:text-amber-400 cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={isAllOptionalSelected}
                                ref={el => { if (el) el.indeterminate = isSomeOptionalSelected; }}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleSection('optional', !isAllOptionalSelected);
                                }}
                                className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 cursor-pointer" 
                            />
                            <span>Optional Dependencies ({optionalSelectedCount}/{optionalNodes.length})</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl divide-y divide-slate-100 dark:divide-zinc-800/60 overflow-hidden shadow-2xs ">
                        {optionalNodes.map(node => {
                            const isSelected = selectedDepIds.includes(node.id);
                            return (
                                <div 
                                    key={node.id} 
                                    onClick={() => onToggleDep(node.id)}
                                    className={`flex items-center justify-between p-2.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors ${!isSelected ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => onToggleDep(node.id)}
                                            className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 cursor-pointer" 
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                        {formatVersionLabel(node.version) && (
                                            <span className="text-[10px] font-mono text-slate-400">{formatVersionLabel(node.version)}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Incompatible Section */}
            {incompatibleNodes.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <span>Incompatible Mods ({incompatibleNodes.length})</span>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2 flex flex-wrap gap-2 text-xs font-mono text-rose-600 dark:text-rose-400">
                        {incompatibleNodes.map(n => (
                            <span key={n.id} className="bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                {n.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
