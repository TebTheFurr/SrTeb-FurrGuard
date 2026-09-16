import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * Tooltip body for a {@link StatTile}: the exact reading first and strongest,
 * then the context that explains it (limit, share of the limit, when it was
 * read). Values are tabular so they stay put while a live reading updates.
 */

const Body = styled.div`
    ${tw`flex flex-col gap-1`};
    min-width: 13rem;
`;

const Reading = styled.span`
    ${tw`text-sm font-semibold`};
    color: var(--color-base);
    font-variant-numeric: tabular-nums;
`;

const Caption = styled.span`
    ${tw`text-xs`};
    color: var(--color-muted);
`;

const Rows = styled.dl`
    ${tw`grid gap-x-4 gap-y-1 mt-1 pt-2 text-xs`};
    grid-template-columns: auto 1fr;
    border-top: 1px solid var(--color-neutral);
`;

const Term = styled.dt`
    color: var(--color-muted);
`;

const Definition = styled.dd`
    ${tw`text-right`};
    color: var(--color-base);
    font-variant-numeric: tabular-nums;
`;

export interface StatDetailRow {
    label: string;
    value: string;
}

export interface StatDetailsProps {
    /** The exact reading, e.g. "1.320.702.976 bytes". */
    value: string;
    /** What the reading is, e.g. "Exact memory in use". */
    caption: string;
    rows: StatDetailRow[];
}

const StatDetails = ({ value, caption, rows }: StatDetailsProps) => (
    <Body>
        <Reading>{value}</Reading>
        <Caption>{caption}</Caption>
        {rows.length > 0 && (
            <Rows>
                {rows.map((row) => (
                    <React.Fragment key={row.label}>
                        <Term>{row.label}</Term>
                        <Definition>{row.value}</Definition>
                    </React.Fragment>
                ))}
            </Rows>
        )}
    </Body>
);

export default StatDetails;
