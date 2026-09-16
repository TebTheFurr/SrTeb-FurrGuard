import React, { useEffect, useLayoutEffect, useRef } from 'react';
import styled from 'styled-components/macro';
import { prefersReducedMotion, tweenValue, VALUE_TRANSITION_MS } from './motion';

/**
 * A number that glides to each new value instead of jumping.
 *
 * Frames are written straight into the text node, so a readout that updates
 * every second animates without re-rendering React on every frame. Digits are
 * tabular so the text doesn't shake while it counts.
 */

const Digits = styled.span`
    font-variant-numeric: tabular-nums;
`;

export interface AnimatedNumberProps {
    value: number;
    format: (value: number) => string;
    duration?: number;
    className?: string;
}

const paint = (node: HTMLSpanElement | null, format: (value: number) => string, value: number) => {
    if (node) {
        node.textContent = format(value);
    }
};

const AnimatedNumber = ({ value, format, duration = VALUE_TRANSITION_MS, className }: AnimatedNumberProps) => {
    const node = useRef<HTMLSpanElement>(null);
    const shown = useRef(value);
    const formatter = useRef(format);

    // After every render: adopt the latest formatter (e.g. a language change) and repaint in place.
    useLayoutEffect(() => {
        formatter.current = format;
        paint(node.current, format, shown.current);
    });

    useEffect(() => {
        const from = shown.current;
        if (from === value || duration <= 0 || prefersReducedMotion()) {
            shown.current = value;
            paint(node.current, formatter.current, value);
            return;
        }

        const started = performance.now();
        let frame = 0;
        const step = (timestamp: number) => {
            const elapsed = timestamp - started;
            shown.current = tweenValue(from, value, elapsed, duration);
            paint(node.current, formatter.current, shown.current);
            if (elapsed < duration) {
                frame = window.requestAnimationFrame(step);
            }
        };
        frame = window.requestAnimationFrame(step);

        // A newer value cancels this tween and starts the next one from wherever the number is now.
        return () => window.cancelAnimationFrame(frame);
    }, [value, duration]);

    return <Digits ref={node} className={className} />;
};

export default AnimatedNumber;
