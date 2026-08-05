import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * Standard section container: a bordered surface with an optional header that
 * carries an icon, a title, a hint and right-aligned actions.
 */
export const Panel = styled.div`
    ${tw`overflow-hidden`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
`;

const HeaderWrapper = styled.div`
    ${tw`flex items-center gap-3 px-4 py-3`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

const HeaderIcon = styled.span`
    ${tw`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-[var(--border-radius)]`};
    background-color: var(--color-neutral);
    color: var(--color-muted);

    svg {
        font-size: 0.8rem;
    }
`;

const HeaderText = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const HeaderTitle = styled.h3`
    ${tw`text-sm font-semibold leading-tight truncate`};
    color: var(--color-base);
    margin: 0;
`;

const HeaderHint = styled.p`
    ${tw`text-xs truncate mt-0.5`};
    color: var(--color-muted);
`;

const HeaderActions = styled.div`
    ${tw`flex items-center gap-2 flex-shrink-0`};
`;

export const PanelBody = styled.div`
    ${tw`p-4`};
`;

/** Full-bleed body for lists that draw their own row separators. */
export const PanelList = styled.div`
    ${tw`flex flex-col`};

    > * + * {
        border-top: 1px solid var(--color-neutral);
    }
`;

export interface PanelHeaderProps {
    icon?: IconProp;
    title: React.ReactNode;
    hint?: React.ReactNode;
    actions?: React.ReactNode;
}

export const PanelHeader = ({ icon, title, hint, actions }: PanelHeaderProps) => (
    <HeaderWrapper>
        {icon && (
            <HeaderIcon>
                <FontAwesomeIcon icon={icon} />
            </HeaderIcon>
        )}
        <HeaderText>
            <HeaderTitle>{title}</HeaderTitle>
            {hint && <HeaderHint>{hint}</HeaderHint>}
        </HeaderText>
        {actions && <HeaderActions>{actions}</HeaderActions>}
    </HeaderWrapper>
);

export default Panel;
