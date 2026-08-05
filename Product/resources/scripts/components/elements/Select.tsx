import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

interface Props {
    hideDropdownArrow?: boolean;
}

const Select = styled.select<Props>`
    ${tw`shadow-sm block px-3 py-2.5 pr-8 border w-full text-sm`};
    background-color: color-mix(in srgb, var(--color-background) 50%, transparent);
    border-color: var(--color-neutral);
    border-radius: calc(var(--border-radius, 12px) * 0.67);
    color: var(--color-base);
    outline: none;
    transition: all 100ms ease-in-out;

    &:focus {
        border-color: var(--color-primary);
    }

    -webkit-appearance: none;
    -moz-appearance: none;
    background-size: 1rem;
    background-repeat: no-repeat;
    background-position-x: calc(100% - 0.75rem);
    background-position-y: center;

    &::-ms-expand {
        display: none;
    }

    ${(props) =>
        !props.hideDropdownArrow &&
        css`
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='%23C2C2C2' d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z'/%3e%3c/svg%3e ");
        `};
        
    option {
        background-color: var(--color-background-secondary);
        color: var(--color-muted);
    }

    &:disabled {
        background-color: color-mix(in srgb, var(--color-background-secondary) 50%, transparent);
        ${tw`cursor-not-allowed opacity-60`};
    }
`;

export default Select;
