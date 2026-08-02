import React from 'react';
import { Layers } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Checkbox } from '../../ui/Checkbox';
import { LAYER, BORDER, TEXT, INTERACTIVE, PILL_TONE, PILL_SIZE } from '../../../theme/layers';

export type DependencyType = 'required' | 'recommended' | 'optional' | 'incompatible';

export interface TreeNode {
    id: string;
    name: string;
    ineq?: string;
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
    disabled?: boolean;
}

export const DependencyTree: React.FC<DependencyTreeProps> = ({
    nodes,
    selectedDepIds,
    onToggleDep,
    onToggleSection,
    disabled = false,
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

    const disabledClass = disabled ? 'opacity-50 pointer-events-none' : '';

    // Section 2: Recommended Calculation
    const recommendedSelectedCount = recommendedNodes.filter(n => selectedDepIds.includes(n.id)).length;
    const isAllRecommendedSelected = recommendedNodes.length > 0 && recommendedSelectedCount === recommendedNodes.length;
    const isSomeRecommendedSelected = recommendedSelectedCount > 0 && !isAllRecommendedSelected;

    // Section 3: Optional Calculation
    const optionalSelectedCount = optionalNodes.filter(n => selectedDepIds.includes(n.id)).length;
    const isAllOptionalSelected = optionalNodes.length > 0 && optionalSelectedCount === optionalNodes.length;
    const isSomeOptionalSelected = optionalSelectedCount > 0 && !isAllOptionalSelected;

    const formatVersionLabel = (ver?: string, ineq?: string) => {
        if (!ver || !ver.trim()) return null;
        const v = ver.trim();
        const formattedVer = v.startsWith('v') ? v : `v${v}`;
        if (!ineq || !ineq.trim()) return formattedVer;
        return `${ineq.trim()} ${formattedVer}`;
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Section 1: Required Dependencies */}
            {requiredNodes.length > 0 && (
                <div className={`flex flex-col gap-1.5 ${disabledClass}`}>
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-sky-600 dark:text-sky-400 select-none">
                        <div className="flex items-center gap-2">
                            <Checkbox checked={disabled ? false : true} disabled={disabled} readOnly accent="sky" aria-label="Required dependencies always included" />
                            <span>Required Dependencies ({requiredNodes.length})</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Always Included</span>
                    </div>
                    <div className={`${LAYER.listSurface} ${BORDER.cardSoft} rounded-xl divide-y divide-slate-100 dark:divide-zinc-700/50 overflow-hidden shadow-2xs`}>
                        {requiredNodes.map(node => (
                            <div key={node.id} className={`flex items-center justify-between p-2.5 text-xs select-none cursor-default ${LAYER.innerInset}`}>
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <Checkbox checked={disabled ? false : true} disabled={disabled} readOnly accent="sky" aria-label={`${node.name} required`} />
                                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                    {formatVersionLabel(node.version, node.ineq) && (
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{formatVersionLabel(node.version, node.ineq)}</span>
                                    )}
                                    {node.isShared && (
                                        <span className={`flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-zinc-800 ${TEXT.secondary} px-1.5 py-0.2 rounded font-mono font-medium shrink-0`}>
                                            <Layers className="w-2.5 h-2.5 text-blue-400" />
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
                <div className={`flex flex-col gap-1.5 ${disabledClass}`}>
                    <div
                        className="flex items-center justify-between px-1 text-xs font-bold text-blue-600 dark:text-blue-400 select-none"
                    >
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={disabled ? false : isAllRecommendedSelected}
                                indeterminate={disabled ? false : isSomeRecommendedSelected}
                                accent="blue"
                                aria-label="Toggle all recommended dependencies"
                                disabled={disabled}
                                onChange={() => !disabled && onToggleSection('recommended', !isAllRecommendedSelected)}
                            />
                            <span>Recommended Dependencies ({recommendedSelectedCount}/{recommendedNodes.length})</span>
                        </div>
                    </div>
                    <div className={`${LAYER.listSurface} ${BORDER.cardSoft} rounded-xl divide-y divide-slate-100 dark:divide-zinc-700/50 overflow-hidden shadow-2xs`}>
                        {recommendedNodes.map(node => {
                            const isSelected = selectedDepIds.includes(node.id);
                            return (
                                <div
                                    key={node.id}
                                    className={`flex items-center justify-between p-2.5 text-xs ${disabled ? '' : INTERACTIVE.rowHover} cursor-pointer transition-colors`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <Checkbox
                                            checked={disabled ? false : isSelected}
                                            accent="blue"
                                            aria-label={`Toggle ${node.name}`}
                                            disabled={disabled}
                                            onChange={() => !disabled && onToggleDep(node.id)}
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                        {formatVersionLabel(node.version, node.ineq) && (
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{formatVersionLabel(node.version, node.ineq)}</span>
                                        )}
                                        {node.isShared && (
                                            <span className={`flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-zinc-800 ${TEXT.secondary} px-1.5 py-0.2 rounded font-mono font-medium shrink-0`}>
                                                <Layers className="w-2.5 h-2.5 text-blue-400" />
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
                <div className={`flex flex-col gap-1.5 ${disabledClass}`}>
                    <div
                        className="flex items-center justify-between px-1 text-xs font-bold text-violet-600 dark:text-violet-400 select-none"
                    >
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={disabled ? false : isAllOptionalSelected}
                                indeterminate={disabled ? false : isSomeOptionalSelected}
                                accent="violet"
                                aria-label="Toggle all optional dependencies"
                                disabled={disabled}
                                onChange={() => !disabled && onToggleSection('optional', !isAllOptionalSelected)}
                            />
                            <span>Optional Dependencies ({optionalSelectedCount}/{optionalNodes.length})</span>
                        </div>
                    </div>
                    <div className={`${LAYER.listSurface} ${BORDER.cardSoft} rounded-xl divide-y divide-slate-100 dark:divide-zinc-700/50 overflow-hidden shadow-2xs`}>
                        {optionalNodes.map(node => {
                            const isSelected = selectedDepIds.includes(node.id);
                            return (
                                <div
                                    key={node.id}
                                    className={`flex items-center justify-between p-2.5 text-xs ${disabled ? '' : INTERACTIVE.rowHover} cursor-pointer transition-colors`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <Checkbox
                                            checked={disabled ? false : isSelected}
                                            accent="violet"
                                            aria-label={`Toggle ${node.name}`}
                                            disabled={disabled}
                                            onChange={() => !disabled && onToggleDep(node.id)}
                                        />
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{node.name}</span>
                                        {formatVersionLabel(node.version, node.ineq) && (
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{formatVersionLabel(node.version, node.ineq)}</span>
                                        )}
                                        {node.isShared && (
                                            <span className={`flex items-center gap-1 text-[9px] bg-slate-100 dark:bg-zinc-800 ${TEXT.secondary} px-1.5 py-0.2 rounded font-mono font-medium shrink-0`}>
                                                <Layers className="w-2.5 h-2.5 text-blue-400" />
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

            {/* Incompatible Section */}
            {incompatibleNodes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <span>Incompatible Mods ({incompatibleNodes.length})</span>
                    </div>
                    <div className="bg-transparent border border-rose-500/30 dark:border-rose-400/30 rounded-xl p-2.5 flex flex-wrap gap-2 text-xs font-mono">
                        {incompatibleNodes.map(n => (
                            <span key={n.id} className={`panel-pill ${PILL_SIZE.compactMono} ${PILL_TONE.incompatibleOutline} font-semibold select-none`}>
                                {n.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
