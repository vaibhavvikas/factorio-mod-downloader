import React, { useState } from 'react';
import { Lock, Download } from 'lucide-react';

type DependencyType = 'required' | 'recommended' | 'optional';

interface ModDependency {
    id: string;
    name: string;
    version: string;
    sizeMB: number;
    type: DependencyType;
    selected: boolean;
}

export const SectionedDependencyResolver: React.FC = () => {
    const [dependencies, setDependencies] = useState<ModDependency[]>([
        { id: '1', name: 'alien-biomes-graphics', version: '0.7.1', sizeMB: 142.0, type: 'required', selected: true },
        { id: '2', name: 'stdlib', version: '1.4.1', sizeMB: 8.2, type: 'required', selected: true },
        { id: '3', name: 'flib', version: '0.16.5', sizeMB: 4.5, type: 'recommended', selected: true },
        { id: '4', name: 'ChangeInserterDropLane', version: '1.2.0', sizeMB: 1.2, type: 'recommended', selected: true },
        { id: '5', name: 'Krastorio2MenuSimulations', version: '2.0.2', sizeMB: 40.8, type: 'optional', selected: false },
        { id: '6', name: 'AlienBiomesHighResUHD', version: '0.7.0', sizeMB: 310.5, type: 'optional', selected: false },
    ]);

    // Toggle a single dependency
    const toggleDependency = (id: string) => {
        setDependencies(prev => prev.map(dep => {
            if (dep.id === id && dep.type !== 'required') {
                return { ...dep, selected: !dep.selected };
            }
            return dep;
        }));
    };

    // Bulk toggle for a specific category
    const setCategorySelection = (type: DependencyType, targetState: boolean) => {
        setDependencies(prev => prev.map(dep => {
            if (dep.type === type && type !== 'required') {
                return { ...dep, selected: targetState };
            }
            return dep;
        }));
    };

    // Grouping logic
    const requiredDeps = dependencies.filter(d => d.type === 'required');
    const recommendedDeps = dependencies.filter(d => d.type === 'recommended');
    const optionalDeps = dependencies.filter(d => d.type === 'optional');

    const totalSelectedSize = dependencies
        .filter(d => d.selected)
        .reduce((acc, curr) => acc + curr.sizeMB, 0)
        .toFixed(1);

    return (
        <div className="flex flex-col gap-5 w-full max-w-3xl mx-auto text-zinc-100 select-none">

            {/* SECTION 1: REQUIRED (Locked) */}
            {requiredDeps.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wider uppercase text-sky-400">
                        <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Required Dependencies ({requiredDeps.length})
                        </span>
                        <span className="text-[11px] font-normal text-zinc-500 lowercase">mandatory for mod execution</span>
                    </div>

                    <div className="border border-sky-500/20 rounded-xl overflow-hidden bg-sky-500/[0.02] divide-y divide-zinc-800/60">
                        {requiredDeps.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between p-3.5 bg-zinc-900/40 opacity-80 cursor-not-allowed">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked disabled className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-sky-500 opacity-60" />
                                    <span className="text-sm font-medium text-zinc-200">{dep.name}</span>
                                    <span className="text-xs font-mono text-zinc-500">v{dep.version}</span>
                                </div>
                                <span className="text-xs font-mono text-zinc-400">{dep.sizeMB.toFixed(1)} MB</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 2: RECOMMENDED */}
            {recommendedDeps.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wider uppercase text-indigo-400">
                        <span>Recommended ({recommendedDeps.filter(d => d.selected).length}/{recommendedDeps.length} selected)</span>
                        <button
                            onClick={() => setCategorySelection('recommended', !recommendedDeps.every(d => d.selected))}
                            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors cursor-pointer lowercase"
                        >
                            {recommendedDeps.every(d => d.selected) ? 'deselect all' : 'select all'}
                        </button>
                    </div>

                    <div className="border border-indigo-500/20 rounded-xl overflow-hidden bg-zinc-900/30 divide-y divide-zinc-800/60">
                        {recommendedDeps.map(dep => (
                            <div key={dep.id} onClick={() => toggleDependency(dep.id)} className="flex items-center justify-between p-3.5 hover:bg-zinc-800/40 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={dep.selected}
                                        onChange={() => { }}
                                        className="w-4 h-4 rounded border-zinc-700 text-indigo-500 focus:ring-0 bg-zinc-950 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-zinc-200">{dep.name}</span>
                                    <span className="text-xs font-mono text-zinc-500">v{dep.version}</span>
                                </div>
                                <span className="text-xs font-mono text-zinc-400">{dep.sizeMB.toFixed(1)} MB</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 3: OPTIONAL */}
            {optionalDeps.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wider uppercase text-violet-400">
                        <span>Optional ({optionalDeps.filter(d => d.selected).length}/{optionalDeps.length} selected)</span>
                        <button
                            onClick={() => setCategorySelection('optional', !optionalDeps.every(d => d.selected))}
                            className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/20 transition-colors cursor-pointer lowercase"
                        >
                            {optionalDeps.every(d => d.selected) ? 'deselect all' : 'select all'}
                        </button>
                    </div>

                    <div className="border border-violet-500/20 rounded-xl overflow-hidden bg-zinc-900/10 divide-y divide-zinc-800/40">
                        {optionalDeps.map(dep => (
                            <div key={dep.id} onClick={() => toggleDependency(dep.id)} className="flex items-center justify-between p-3.5 hover:bg-zinc-800/30 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={dep.selected}
                                        onChange={() => { }}
                                        className="w-4 h-4 rounded border-zinc-700 text-violet-500 focus:ring-0 bg-zinc-950 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-zinc-300">{dep.name}</span>
                                    <span className="text-xs font-mono text-zinc-600">v{dep.version}</span>
                                </div>
                                <span className="text-xs font-mono text-zinc-500">{dep.sizeMB.toFixed(1)} MB</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Download Action Footer */}
            <button className="w-full mt-2 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-600/10 flex items-center justify-center gap-2 transition-all cursor-pointer">
                <Download className="w-4 h-4" /> Download Selected Mods (~{totalSelectedSize} MB)
            </button>

        </div>
    );
};