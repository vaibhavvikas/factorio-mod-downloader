import type { InstalledModItem } from '../context/AppContext';

export interface ConflictModalData {
    targetUpdates: { name: string; title: string; version: string }[];
    autoUpgradedDeps: { name: string; title: string; fromVersion: string; toVersion: string }[];
    fullBatch: { id: string; title: string; version: string; file_name: string; sha1: string }[];
}

export interface DeleteModalData {
    targetMod: InstalledModItem;
    exclusiveDeps: InstalledModItem[];
    protectedDeps: { name: string; title: string; requiredBy: string[] }[];
}

export interface BulkDeleteModalData {
    primaryTargetMods: InstalledModItem[];
    exclusiveDeps: InstalledModItem[];
    protectedDeps: { name: string; title: string; requiredBy: string[] }[];
}

export const isDirectRequiredDependency = (rawDep: string): boolean => {
    const trimmed = rawDep.trim();
    if (trimmed.startsWith('?') || trimmed.startsWith('~') || trimmed.startsWith('!')) {
        return false;
    }
    if (/^\([^)]+\)\s*[?~!]/i.test(trimmed)) {
        return false;
    }
    return true;
};

export const computeReverseDependencies = (
    installedMods: InstalledModItem[]
): Map<string, string[]> => {
    const dependentsMap = new Map<string, string[]>();

    installedMods.forEach(parentMod => {
        parentMod.dependencies.forEach(rawDep => {
            if (!isDirectRequiredDependency(rawDep)) return;

            const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();

            if (depName && depName !== 'base') {
                if (!dependentsMap.has(depName)) {
                    dependentsMap.set(depName, []);
                }
                const list = dependentsMap.get(depName)!;
                if (!list.includes(parentMod.title || parentMod.name)) {
                    list.push(parentMod.title || parentMod.name);
                }
            }
        });
    });

    return dependentsMap;
};

export const isInternalCategoryMod = (mod: InstalledModItem): boolean => {
    if (mod.category && mod.category.toLowerCase() === 'internal') {
        return true;
    }
    const nameLower = mod.name.toLowerCase();
    if (nameLower.endsWith('-assets') || nameLower.endsWith('_assets') || nameLower.includes('asset')) {
        return true;
    }
    return false;
};

export const calculateDeleteImpact = (
    targetMod: InstalledModItem,
    installedMods: InstalledModItem[]
): DeleteModalData => {
    const installedByName = new Map<string, InstalledModItem>();
    installedMods.forEach(m => installedByName.set(m.name, m));

    const candidateDeps = new Set<string>();
    const collectDeps = (mod: InstalledModItem) => {
        mod.dependencies.forEach(rawDep => {
            if (!isDirectRequiredDependency(rawDep)) return;

            const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();
            if (depName && depName !== 'base' && installedByName.has(depName) && !candidateDeps.has(depName)) {
                const depMod = installedByName.get(depName)!;
                if (isInternalCategoryMod(depMod)) {
                    candidateDeps.add(depName);
                    collectDeps(depMod);
                }
            }
        });
    };
    collectDeps(targetMod);

    const exclusiveDeps: InstalledModItem[] = [];
    const protectedDeps: { name: string; title: string; requiredBy: string[] }[] = [];

    candidateDeps.forEach(depName => {
        const depMod = installedByName.get(depName);
        if (!depMod) return;

        const requiredByExternal: string[] = [];
        installedMods.forEach(otherMod => {
            if (otherMod.name === targetMod.name || candidateDeps.has(otherMod.name)) return;

            otherMod.dependencies.forEach(rawDep => {
                if (!isDirectRequiredDependency(rawDep)) return;

                const reqName = rawDep.trim().split(/[\s>=<]/)[0].trim();
                if (reqName === depName) {
                    requiredByExternal.push(otherMod.title || otherMod.name);
                }
            });
        });

        if (requiredByExternal.length > 0) {
            protectedDeps.push({
                name: depName,
                title: depMod.title || depName,
                requiredBy: requiredByExternal
            });
        } else {
            exclusiveDeps.push(depMod);
        }
    });

    return {
        targetMod,
        exclusiveDeps,
        protectedDeps
    };
};

export const calculateBulkDeleteImpact = (
    incompatibleMods: InstalledModItem[],
    installedMods: InstalledModItem[]
): BulkDeleteModalData => {
    const installedByName = new Map<string, InstalledModItem>();
    installedMods.forEach(m => installedByName.set(m.name, m));

    // Separate incompatibleMods into primary mods vs internal category mods
    const primaryTargetMods: InstalledModItem[] = [];
    const internalTargetMods: InstalledModItem[] = [];

    incompatibleMods.forEach(mod => {
        if (isInternalCategoryMod(mod)) {
            internalTargetMods.push(mod);
        } else {
            primaryTargetMods.push(mod);
        }
    });

    // If all incompatible mods are internal mods, treat them as primary targets
    if (primaryTargetMods.length === 0 && internalTargetMods.length > 0) {
        primaryTargetMods.push(...internalTargetMods);
        internalTargetMods.length = 0;
    }

    const deleteSetNames = new Set(incompatibleMods.map(m => m.name));

    // Also collect any additional internal dependencies required by the target mods
    const candidateDeps = new Set<string>();
    const collectDeps = (mod: InstalledModItem) => {
        mod.dependencies.forEach(rawDep => {
            if (!isDirectRequiredDependency(rawDep)) return;

            const depName = rawDep.trim().split(/[\s>=<]/)[0].trim();
            if (depName && depName !== 'base' && installedByName.has(depName) && !candidateDeps.has(depName)) {
                const depMod = installedByName.get(depName)!;
                if (isInternalCategoryMod(depMod)) {
                    candidateDeps.add(depName);
                    collectDeps(depMod);
                }
            }
        });
    };

    incompatibleMods.forEach(m => collectDeps(m));

    const exclusiveDepsMap = new Map<string, InstalledModItem>();
    internalTargetMods.forEach(m => exclusiveDepsMap.set(m.name, m));

    const protectedDeps: { name: string; title: string; requiredBy: string[] }[] = [];

    candidateDeps.forEach(depName => {
        const depMod = installedByName.get(depName);
        if (!depMod) return;

        const requiredByExternal: string[] = [];
        installedMods.forEach(otherMod => {
            if (deleteSetNames.has(otherMod.name) || candidateDeps.has(otherMod.name)) return;

            otherMod.dependencies.forEach(rawDep => {
                if (!isDirectRequiredDependency(rawDep)) return;

                const reqName = rawDep.trim().split(/[\s>=<]/)[0].trim();
                if (reqName === depName) {
                    requiredByExternal.push(otherMod.title || otherMod.name);
                }
            });
        });

        if (requiredByExternal.length > 0) {
            protectedDeps.push({
                name: depName,
                title: depMod.title || depName,
                requiredBy: requiredByExternal
            });
            exclusiveDepsMap.delete(depName);
        } else {
            exclusiveDepsMap.set(depName, depMod);
        }
    });

    return {
        primaryTargetMods,
        exclusiveDeps: Array.from(exclusiveDepsMap.values()),
        protectedDeps
    };
};
