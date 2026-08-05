import styled from 'styled-components/macro';
import tw from 'twin.macro';

export default styled.div<{ $hoverable?: boolean }>`
    ${tw`flex no-underline items-center p-4 border transition-all duration-150 overflow-hidden`};
    background-color: var(--color-background-secondary);
    border-color: var(--color-neutral);
    color: var(--color-base);
    border-radius: var(--border-radius, 12px);

    ${(props) =>
        props.$hoverable !== false &&
        `
        &:hover {
            border-color: var(--color-primary);
        }
    `};

    & .icon {
        ${tw`rounded-full w-16 flex items-center justify-center p-3`};
        background-color: var(--color-neutral);
        color: var(--color-muted);
    }
`;
