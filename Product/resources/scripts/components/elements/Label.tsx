import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Label = styled.label<{ isLight?: boolean }>`
    ${tw`block text-sm font-semibold mb-2 ml-1`};
    color: var(--color-muted);
    ${(props) => props.isLight && tw`text-neutral-700`};
`;

export default Label;
