import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

interface EmptyStateProps {
    title: string;
    message?: string;
}

const Card = styled.div`
    ${tw`flex flex-col items-center text-center px-8 py-10 w-full`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const Title = styled.h3`
    ${tw`text-lg font-medium mb-2`};
    color: var(--color-base);
`;

const Message = styled.p`
    ${tw`text-sm leading-relaxed`};
    color: var(--color-muted);
`;

const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => {
    return (
        <Card>
            <Title>{title}</Title>
            {message && <Message>{message}</Message>}
        </Card>
    );
};

export default EmptyState;
