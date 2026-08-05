import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { stateColors } from './tokens';

export type ChipTone = 'default' | 'warning' | 'danger' | 'success';

const toneColor = (tone: ChipTone): string => {
    if (tone === 'warning') return stateColors.warning;
    if (tone === 'danger') return stateColors.danger;
    if (tone === 'success') return stateColors.success;
    return 'var(--color-muted)';
};

const Chip = styled.span<{ $tone: ChipTone }>`
    ${tw`inline-flex items-center gap-1.5 text-xs min-w-0`};
    color: ${({ $tone }) => toneColor($tone)};

    svg {
        ${tw`flex-shrink-0`};
        font-size: 0.7rem;
        opacity: 0.85;
    }

    > span {
        ${tw`truncate`};
    }
`;

export interface MetaChipProps {
    icon?: IconProp;
    tone?: ChipTone;
    title?: string;
    children: React.ReactNode;
}

/** Compact icon + text label used for metadata rows (node, location, uptime…). */
const MetaChip = ({ icon, tone = 'default', title, children }: MetaChipProps) => (
    <Chip $tone={tone} title={title}>
        {icon && <FontAwesomeIcon icon={icon} />}
        <span>{children}</span>
    </Chip>
);

export default MetaChip;
