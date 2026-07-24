import React from 'react';
import { Layers } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Checkbox } from '../ui/Checkbox';

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
    const { installedMods } = useAppContext();

    const renderInstalledStatus = (name: string) => {
        const inst = installedMods.find(m => m.name === name);
        if (inst) {
            return (
                <span className="flex items-center text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono font-medium shrink-0 border border-emerald-200/40 dark:border-emerald-800/20">
                    installed: v{inst.version}
                </span>
            );
        }
        return null;
    };
    if (!nodes || nodes.length === 0) {
        return (
            <div className="text-center py-4 text-xs text-slate-400 dark:text-zinc-600 font-mono">
                No dependencies listed for this version.
            </div>
        );
    }

    const requiredNodes = nodes.filter(n => n.type === 'required').sort((a, b) => a.name.localeCompare(b.name));
    const recommendedNodes = nodes.filter(n => n.type === 'recommended').sort((a, b) => a.name.localeCompare(b.name));
    const optionalNodes = nodes.filter(n => n.type === 'optional').sort((a, b) => a.name.localeCompare(b.name));
    const incompatibleNodes = nodes.filter(n => n.type === 'incompatible').sort((a, b) => a.name.localeCompare(b.name));

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
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-sky-600 dark:text-sky-400 select-none">
                        <div className="flex items-center gap-2">
                            <Checkbox checked disabled readOnly accent="sky" aria-label="Required dependencies always included" />
                            <span>Required Dependencies ({requiredNodes.length})</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Always Included</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl divide-y divide-slate-100 dark:divide-zinc-800/60 overflow-hidden shadow-2xs">
                        {requiredNodes.map(node => (
                            <div key={node.id} className="flex items-center justify-between p-2.5 text-xs select-none cursor-default bg-slate-50/30 dark:bg-zinc-900/40">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <Checkbox checked disabled readOnly accent="sky" aria-label={`${node.name} required`} />
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
                                    {renderInstalledStatus(node.name)}
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
                            <Checkbox
                                checked={isAllRecommendedSelected}
                                indeterminate={isSomeRecommendedSelected}
                                accent="indigo"
                                aria-label="Toggle all recommended dependencies"
                                onChange={() => onToggleSection('recommended', !isAllRecommendedSelected)}
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
                                        <Checkbox
                                            checked={isSelected}
                                            accent="indigo"
                                            aria-label={`Toggle ${node.name}`}
                                            onChange={() => onToggleDep(node.id)}
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
                                        {renderInstalledStatus(node.name)}
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
                        className="flex items-center justify-between px-1 text-xs font-bold text-violet-600 dark:text-violet-400 cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={isAllOptionalSelected}
                                indeterminate={isSomeOptionalSelected}
                                accent="violet"
                                aria-label="Toggle all optional dependencies"
                                onChange={() => onToggleSection('optional', !isAllOptionalSelected)}
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
                                        <Checkbox
                                            checked={isSelected}
                                            accent="violet"
                                            aria-label={`Toggle ${node.name}`}
                                            onChange={() => onToggleDep(node.id)}
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                        {formatVersionLabel(node.version) && (
                                            <span className="text-[10px] font-mono text-slate-400">{formatVersionLabel(node.version)}</span>
                                        )}
                                        {renderInstalledStatus(node.name)}
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
