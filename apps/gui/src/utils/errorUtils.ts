export function formatUserFriendlyError(error: any, modName?: string): string {
    if (!error) return 'An unknown error occurred.';
    const raw = typeof error === 'string' ? error : error?.message || error?.toString() || 'An unknown error occurred.';

    const lower = raw.toLowerCase();

    // Check 404 / Not Found
    if (raw.includes('404') || lower.includes('not found')) {
        return modName
            ? `Mod "${modName}" was not found on the Factorio Mod Portal.`
            : 'Mod was not found on the Factorio Mod Portal.';
    }

    // Check 403 / 401 / Unauthorized
    if (raw.includes('403') || raw.includes('401') || lower.includes('forbidden') || lower.includes('unauthorized')) {
        return 'Access denied by Factorio Mod Portal. Please check your credentials in Settings.';
    }

    // Check 500 / 502 / 503 / 504
    if (raw.includes('500') || raw.includes('502') || raw.includes('503') || raw.includes('504')) {
        return 'Factorio Mod Portal is temporarily experiencing server issues. Please try again later.';
    }

    // Network / DNS / Timeout
    if (lower.includes('connect') || lower.includes('timeout') || lower.includes('dns') || lower.includes('network')) {
        return 'Network connection error. Please check your internet connection.';
    }

    // Strip raw internal reqwest URL wrappers if present
    const stripped = raw
        .replace(/HTTP status client error\s*\([^)]*\)\s*/gi, '')
        .replace(/for url\s*\([^)]*\)/gi, '')
        .replace(/https?:\/\/mods\.factorio\.com[^\s)]*/gi, '')
        .trim();

    return stripped || 'An error occurred while communicating with the Mod Portal.';
}
