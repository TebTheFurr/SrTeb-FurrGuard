import styled from 'styled-components/macro';
import tw from 'twin.macro';

const ContentContainer = styled.div`
    ${tw`w-full`};
    
    @media (max-width: 768px) {
        padding-left: 1rem;
        padding-right: 1rem;
    }
`;
ContentContainer.displayName = 'ContentContainer';

export default ContentContainer;
