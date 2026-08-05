import React from 'react';
import styled from 'styled-components/macro';

interface CodeProps {
    dark?: boolean | undefined;
    className?: string;
    children: React.ReactChild | React.ReactFragment | React.ReactPortal;
}

const StyledCode = styled.code<{ $dark?: boolean }>`
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    display: inline-block;
    border-radius: calc(var(--border-radius, 8px) * 0.5);
    background-color: var(--color-background-secondary);
    color: var(--color-base);
    border: 1px solid var(--color-neutral);
`;

export default ({ dark, className, children }: CodeProps) => (
    <StyledCode $dark={dark} className={className}>
        {children}
    </StyledCode>
);
