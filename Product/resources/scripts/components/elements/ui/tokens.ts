/**
 * Shared visual tokens for the panel UI.
 *
 * Surfaces, borders and text colours always come from the theme editor CSS
 * variables so every component follows the configured palette and light/dark
 * mode. Only the semantic state colours are fixed, because "danger" must read
 * as red regardless of the brand palette.
 */

export const stateColors = {
    danger: '#ef4444',
    warning: '#eab308',
    success: '#22c55e',
} as const;

export type UsageLevel = 'normal' | 'warning' | 'danger';

/** Thresholds match the alarm behaviour used across the dashboard cards. */
export const usageLevel = (percentage: number | null | undefined): UsageLevel => {
    if (percentage === null || percentage === undefined) return 'normal';
    if (percentage >= 90) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'normal';
};

/** Bar / accent colour for a usage level. */
export const usageColor = (level: UsageLevel): string => {
    if (level === 'danger') return stateColors.danger;
    if (level === 'warning') return stateColors.warning;
    return 'var(--color-primary)';
};

/** Foreground colour for a usage level, falling back to the base text colour. */
export const usageTextColor = (level: UsageLevel): string => {
    if (level === 'danger') return stateColors.danger;
    if (level === 'warning') return stateColors.warning;
    return 'var(--color-base)';
};

/** Usage percentage, or null when the resource is unlimited (limit of 0). */
export const percentOf = (used: number, limit: number): number | null => (limit > 0 ? (used / limit) * 100 : null);

export const UNLIMITED = '∞';
