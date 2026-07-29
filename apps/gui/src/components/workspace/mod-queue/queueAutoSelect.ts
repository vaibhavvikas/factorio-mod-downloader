import type { DependencyType } from './DependencyTree';

export const QUEUE_AUTO_RECOMMENDED_KEY = 'queue_auto_recommended';
export const QUEUE_AUTO_OPTIONAL_KEY = 'queue_auto_optional';

export interface QueueAutoIncludeSettings {
    recommended: boolean;
    optional: boolean;
}

export function getQueueAutoIncludeSettings(): QueueAutoIncludeSettings {
    const savedRecommended = localStorage.getItem(QUEUE_AUTO_RECOMMENDED_KEY);
    const savedOptional = localStorage.getItem(QUEUE_AUTO_OPTIONAL_KEY);
    return {
        recommended: savedRecommended !== null ? savedRecommended === 'true' : true,
        optional: savedOptional !== null ? savedOptional === 'true' : false,
    };
}

function shouldAutoSelectDep(type: DependencyType, settings: QueueAutoIncludeSettings): boolean {
    if (type === 'required') return true;
    if (type === 'recommended') return settings.recommended;
    if (type === 'optional') return settings.optional;
    return false;
}

export function getInitialSelectedDepIds<T extends { id: string; type: DependencyType }>(
    deps: T[],
    settings?: QueueAutoIncludeSettings,
): string[] {
    const resolved = settings ?? getQueueAutoIncludeSettings();
    return deps.filter(d => shouldAutoSelectDep(d.type, resolved)).map(d => d.id);
}
