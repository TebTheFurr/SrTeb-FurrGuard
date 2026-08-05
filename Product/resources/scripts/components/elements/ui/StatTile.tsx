import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { stateColors, UNLIMITED, UsageLevel, usageColor, usageLevel, usageTextColor } from './tokens';

/**
 * A single resource readout: icon + label, the current value against its
 * limit, and a progress bar. Shared by the dashboard server cards and the
 * console so both render usage identically.
 *
 * Pass `percentage: null` (or omit it) for unlimited resources — the bar is
 * hidden and the limit renders as ∞.
 */

const Tile = styled.div<{ $level: UsageLevel }>`
    ${tw`p-3 flex flex-col gap-2 rounded-[var(--border-radius)] transition-colors duration-150`};
    background-color: ${({ $level }) => ($level === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-background)')};
    border: 1px solid ${({ $level }) => ($level === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-neutral)')};
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
`;

const Limit = styled.span`
    ${tw`text-xs flex-shrink-0 select-none`};
    color: var(--color-muted);
`;

const Track = styled.div`
    ${tw`w-full h-1 rounded-full overflow-hidden`};
    background-color: var(--color-neutral);
`;

const Bar = styled.div<{ $percentage: number; $level: UsageLevel }>`
    ${tw`h-full rounded-full transition-all duration-300`};
    width: ${({ $percentage }) => Math.max(Math.min($percentage, 100), 0)}%;
    background-color: ${({ $level }) => usageColor($level)};
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
    className?: string;
}

const StatTile = ({ icon, label, value, limit, percentage, copyValue, hideLimit, className }: StatTileProps) => {
    const level = usageLevel(percentage);

    const tile = (
        <Tile $level={level} className={className}>
            <Label $level={level}>
                <FontAwesomeIcon icon={icon} />
                {label}
            </Label>
            <Figures>
                <Value $level={level}>{value}</Value>
                {!hideLimit && <Limit>/ {limit ?? UNLIMITED}</Limit>}
            </Figures>
            {percentage !== null && percentage !== undefined && (
                <Track>
                    <Bar $percentage={percentage} $level={level} />
                </Track>
            )}
        </Tile>
    );

    return copyValue ? <CopyOnClick text={copyValue}>{tile}</CopyOnClick> : tile;
};

export default StatTile;
