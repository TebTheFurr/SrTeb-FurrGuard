import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { formatClock, formatDay } from '@/components/server/console/statsFormat';

/**
 * Hover readout for a live chart: the moment (hours, minutes, seconds and the
 * date) and, for every series, the exact value at that moment. Values lead and
 * series names follow, since the reader already knows which chart they're on.
 */

export interface HoverValue {
    key: string;
    label: string;
    color: string;
    value: number;
}

export interface HoverReading {
    /** Epoch milliseconds of the hovered reading. */
    time: number;
    /** Caret position inside the chart frame, in CSS pixels. */
    left: number;
    top: number;
    /** Open towards the left when the caret is on the right half of the chart. */
    flip: boolean;
    values: HoverValue[];
}

const CARET_GAP = '14px';

const Card = styled.div<{ $flip: boolean }>`
    ${tw`absolute z-20 flex flex-col gap-2 px-3 py-2 text-xs whitespace-nowrap pointer-events-none`};
    background-color: var(--color-background);
    color: var(--color-base);
    border: 1px solid var(--color-neutral);
    border-radius: calc(var(--border-radius, 12px) * 0.67);
    transform: translate(${({ $flip }) => ($flip ? `calc(-100% - ${CARET_GAP})` : CARET_GAP)}, -50%);
`;

const Moment = styled.div`
    ${tw`flex items-baseline gap-2`};
`;

const Clock = styled.span`
    ${tw`text-sm font-semibold`};
    font-variant-numeric: tabular-nums;
`;

const Day = styled.span`
    color: var(--color-muted);
`;

const Row = styled.div`
    ${tw`flex items-start gap-2`};
`;

/** A short stroke in the series colour: the same mark as the line it describes. */
const SeriesKey = styled.span<{ $color: string }>`
    ${tw`flex-shrink-0 w-3 rounded-full`};
    height: 2px;
    margin-top: 0.55rem;
    background-color: ${({ $color }) => $color};
`;

const Readout = styled.div`
    ${tw`flex flex-col`};
`;

const Headline = styled.span`
    ${tw`flex items-baseline gap-2`};
`;

const Value = styled.span`
    ${tw`text-sm font-semibold`};
    font-variant-numeric: tabular-nums;
`;

const Muted = styled.span`
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
`;

interface ChartHoverCardProps {
    reading: HoverReading;
    locale: string;
    formatValue: (value: number) => string;
    formatDetail?: (value: number) => string | null;
}

const ChartHoverCard = ({ reading, locale, formatValue, formatDetail }: ChartHoverCardProps) => (
    <Card
        $flip={reading.flip}
        aria-hidden={true}
        // The caret moves every frame while the chart scrolls; a class per position would flood the stylesheet.
        style={{ left: `${reading.left}px`, top: `${reading.top}px` }}
    >
        <Moment>
            <Clock>{formatClock(reading.time, locale)}</Clock>
            <Day>{formatDay(reading.time, locale)}</Day>
        </Moment>
        {reading.values.map((entry) => {
            const detail = formatDetail ? formatDetail(entry.value) : null;

            return (
                <Row key={entry.key}>
                    <SeriesKey $color={entry.color} />
                    <Readout>
                        <Headline>
                            <Value>{formatValue(entry.value)}</Value>
                            <Muted>{entry.label}</Muted>
                        </Headline>
                        {detail && <Muted>{detail}</Muted>}
                    </Readout>
                </Row>
            );
        })}
    </Card>
);

export default ChartHoverCard;
