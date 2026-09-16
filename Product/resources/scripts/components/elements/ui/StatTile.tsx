import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import CopyOnClick from '@/components/elements/CopyOnClick';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { EASE_OUT_CUBIC, VALUE_TRANSITION_MS } from './motion';
import { stateColors, UNLIMITED, UsageLevel, usageColor, usageLevel, usageTextColor } from './tokens';

/**
 * A single resource readout: icon + label, the current value against its
 * limit, and a progress bar. Shared by the dashboard server cards and the
 * console so both render usage identically.
 *
 * Pass `percentage: null` (or omit it) for unlimited resources — the bar is
 * hidden and the limit renders as ∞. Pass `details` to reveal the exact
 * reading in a tooltip on hover or keyboard focus.
 */

const Tile = styled.div<{ $level: UsageLevel }>`
    ${tw`h-full p-3 flex flex-col gap-2 rounded-[var(--border-radius)] transition-colors duration-150`};
    background-color: ${({ $level }) => ($level === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-background)')};
    border: 1px solid ${({ $level }) => ($level === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-neutral)')};

    &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }
`;

const Label = styled.span<{ $level: UsageLevel }>`
    ${tw`inline-flex items-center gap-2 text-xs font-medium`};
    color: ${({ $level }) => ($level === 'danger' ? stateColors.danger : 'var(--color-muted)')};

    svg {
        ${tw`flex-shrink-0`};
        font-size: 0.7rem;
    }
`;

const Figures = styled.div`
    ${tw`flex items-baseline gap-1 min-w-0`};
`;

const Value = styled.span<{ $level: UsageLevel }>`
    ${tw`text-sm font-semibold truncate`};
    color: ${({ $level }) => usageTextColor($level)};
    font-variant-numeric: tabular-nums;
`;

const Limit = styled.span`
    ${tw`text-xs flex-shrink-0 select-none`};
    color: var(--color-muted);
`;

const Hint = styled.span`
    ${tw`text-xs truncate`};
    color: var(--color-muted);
`;

const Track = styled.div`
    ${tw`w-full h-1 rounded-full overflow-hidden`};
    background-color: var(--color-neutral);
`;

interface BarProps {
    $percentage: number;
    $level: UsageLevel;
}

// The width goes through `style`: live readings change it every second, and interpolating it
// would mint a new CSS class per value. The bar glides with the same timing as AnimatedNumber.
const Bar = styled.div.attrs<BarProps>(({ $percentage }) => ({
    style: { width: `${Math.max(Math.min($percentage, 100), 0)}%` },
}))<BarProps>`
    ${tw`h-full rounded-full`};
    background-color: ${({ $level }) => usageColor($level)};
    transition: width ${VALUE_TRANSITION_MS}ms ${EASE_OUT_CUBIC}, background-color 150ms ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

/** Gives the tooltip a ref-able element when the tile is also wrapped by CopyOnClick. */
const TooltipAnchor = styled.div`
    ${tw`h-full`};
`;

export interface StatTileProps {
    icon: IconProp;
    label: string;
    value: React.ReactNode;
    /** Formatted limit, e.g. "4 GB". Null/undefined renders as ∞. */
    limit?: string | null;
    /** Usage percentage. Null hides the progress bar (unlimited resource). */
    percentage?: number | null;
    /** When set, clicking the tile copies this value to the clipboard. */
    copyValue?: string;
    /** Hides the limit segment entirely, for values that have no maximum. */
    hideLimit?: boolean;
    /** Optional muted line under the value (e.g. "no limit" or an absolute date). */
    hint?: React.ReactNode;
    /** Tooltip content with the exact reading, shown on hover and keyboard focus. */
    details?: React.ReactElement;
    className?: string;
}

const StatTile = ({
    icon,
    label,
    value,
    limit,
    percentage,
    copyValue,
    hideLimit,
    hint,
    details,
    className,
}: StatTileProps) => {
    const level = usageLevel(percentage);

    const tile = (
        <Tile $level={level} className={className} tabIndex={details ? 0 : undefined}>
            <Label $level={level}>
                <FontAwesomeIcon icon={icon} />
                {label}
            </Label>
            <Figures>
                <Value $level={level}>{value}</Value>
                {!hideLimit && <Limit>/ {limit ?? UNLIMITED}</Limit>}
            </Figures>
            {hint && <Hint>{hint}</Hint>}
            {percentage !== null && percentage !== undefined && (
                <Track>
                    <Bar $percentage={percentage} $level={level} />
                </Track>
            )}
        </Tile>
    );

    const copyable = copyValue ? <CopyOnClick text={copyValue}>{tile}</CopyOnClick> : tile;
    if (!details) {
        return copyable;
    }

    return (
        <Tooltip content={details} delay={{ open: 150, close: 0 }}>
            {copyValue ? <TooltipAnchor>{copyable}</TooltipAnchor> : tile}
        </Tooltip>
    );
};

export default StatTile;
