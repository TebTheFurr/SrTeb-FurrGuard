import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * Consistent page title block: heading, optional description, a metadata row
 * for chips/badges, and right-aligned actions.
 */

const Wrapper = styled.div`
    ${tw`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-4`};
`;

const Text = styled.div`
    ${tw`min-w-0`};
`;

const Title = styled.h1`
    ${tw`font-header font-medium text-2xl leading-tight truncate`};
    color: var(--color-base);
`;

const Description = styled.p`
    ${tw`text-sm mt-1`};
    color: var(--color-muted);
`;

const MetaRow = styled.div`
    ${tw`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2`};
`;

const Actions = styled.div`
    ${tw`flex items-center gap-2 flex-shrink-0`};
`;

export interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Chips, badges or status indicators rendered under the title. */
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

const PageHeader = ({ title, description, meta, actions, className }: PageHeaderProps) => (
    <Wrapper className={className}>
        <Text>
            <Title>{title}</Title>
            {description && <Description>{description}</Description>}
            {meta && <MetaRow>{meta}</MetaRow>}
        </Text>
        {actions && <Actions>{actions}</Actions>}
    </Wrapper>
);

export default PageHeader;
