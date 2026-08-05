import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export interface Props {
    isLight?: boolean;
    hasError?: boolean;
}

const light = css<Props>`
    ${tw`bg-white text-neutral-800`};
    border-color: var(--color-neutral);
    
    &:focus {
        border-color: var(--color-primary);
    }

    &:disabled {
        ${tw`bg-neutral-100`};
        border-color: var(--color-neutral);
    }
`;

const checkboxStyle = css<Props>`
    ${tw`cursor-pointer appearance-none inline-block align-middle select-none flex-shrink-0 w-4 h-4 border`};
    background-color: color-mix(in srgb, var(--color-background) 50%, transparent);
    border-color: var(--color-neutral);
    border-radius: 4px;
    color: var(--color-primary);
    color-adjust: exact;
    background-origin: border-box;
    transition: all 300ms ease-in-out;

    &:checked {
        ${tw`border-transparent bg-no-repeat bg-center`};
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e");
        background-color: var(--color-primary);
        background-size: 100% 100%;
    }

    &:focus {
        ${tw`outline-none`};
        border-color: var(--color-primary);
    }

    &:hover:not(:disabled):not(:checked) {
        border-color: var(--color-secondary);
    }
`;

const inputStyle = css<Props>`
    resize: none;
    ${tw`appearance-none w-full min-w-0`};
    ${tw`px-3 py-2.5 border text-sm shadow-sm`};
    background-color: color-mix(in srgb, var(--color-background) 50%, transparent);
    border-color: var(--color-neutral);
    border-radius: calc(var(--border-radius, 12px) * 0.67);
    color: var(--color-base);
    outline: none;
    transition: all 100ms ease-in-out;

    &::placeholder {
        color: var(--color-muted);
    }


    & + .input-help {
        ${tw`mt-1 text-xs`};
        ${(props) => (props.hasError ? tw`text-red-200` : css`color: var(--color-muted);`)};
    }

    &:required,
    &:invalid {
        ${tw`shadow-none`};
    }

    &:not(:disabled):not(:read-only):focus {
        border-color: var(--color-primary);
        ${(props) => props.hasError && tw`border-red-400`};
    }

    &:disabled {
        background-color: color-mix(in srgb, var(--color-background-secondary) 50%, transparent);
        ${tw`cursor-not-allowed opacity-60`};
    }

    ${(props) => props.isLight && light};
    ${(props) => props.hasError && tw`text-red-100 border-red-400 hover:border-red-300`};
`;

const Input = styled.input<Props>`
    &:not([type='checkbox']):not([type='radio']) {
        ${inputStyle};
    }

    &[type='checkbox'],
    &[type='radio'] {
        ${checkboxStyle};

        &[type='radio'] {
            ${tw`rounded-full`};
        }
    }
`;
const Textarea = styled.textarea<Props>`
    ${inputStyle}
`;

export { Textarea };
export default Input;
