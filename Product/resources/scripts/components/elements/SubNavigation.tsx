import styled from 'styled-components/macro';
import tw from 'twin.macro';

const SubNavigation = styled.div`
    ${tw`w-full shadow overflow-x-auto`};
    background-color: var(--color-background-secondary);
    border-bottom: 1px solid var(--color-neutral);

    & > div {
        ${tw`flex items-center text-sm mx-auto px-2`};
        max-width: 1200px;

        & > a,
        & > div {
            ${tw`inline-block py-3 px-4 no-underline whitespace-nowrap transition-all duration-150`};
            color: var(--color-muted);

            &:not(:first-of-type) {
                ${tw`ml-2`};
            }

            &:hover {
                color: var(--color-base);
            }

            &:active,
            &.active {
                color: var(--color-base);
                box-shadow: inset 0 -2px var(--color-primary);
            }
        }
    }
`;

export default SubNavigation;
