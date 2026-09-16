/**
 * Motion shared by live readouts.
 *
 * Animated numbers and usage bars use the same timing so a new reading lands
 * on both at once. The curve decelerates, so most of the movement happens right
 * after the reading arrives and the value settles before the next one.
 */

/** Wings streams a new reading roughly every second; the tween finishes just before that. */
export const VALUE_TRANSITION_MS = 900;

/** CSS equivalent of {@link easeOutCubic}, for transitions driven by the browser. */
export const EASE_OUT_CUBIC = 'cubic-bezier(0.33, 1, 0.68, 1)';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - clamp01(progress), 3);

/** Value shown `elapsed` ms into a tween from `from` to `to`. */
export const tweenValue = (from: number, to: number, elapsed: number, duration: number): number => {
    if (duration <= 0 || elapsed >= duration) {
        return to;
    }

    return from + (to - from) * easeOutCubic(elapsed / duration);
};

export const prefersReducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
