import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';
import styled from 'styled-components/macro';

interface Props {
    icon?: IconProp;
    title: string | React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

const BoxWrapper = styled.div`
    ${tw`overflow-hidden`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
`;

const BoxHeader = styled.div`
    ${tw`p-3`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

const TitledGreyBox = ({ icon, title, children, className }: Props) => (
    <BoxWrapper className={className}>
        <BoxHeader>
            {typeof title === 'string' ? (
                <p css={tw`text-sm uppercase`} style={{ color: 'var(--color-base)' }}>
                    {icon && (
                        <FontAwesomeIcon icon={icon} css={tw`mr-2`} style={{ color: 'var(--color-muted)' }} />
                    )}
                    {title}
                </p>
            ) : (
                title
            )}
        </BoxHeader>
        <div css={tw`p-3`}>{children}</div>
    </BoxWrapper>
);

export default memo(TitledGreyBox, isEqual);
