import React from 'react';
import tw from 'twin.macro';
import Icon from '@/components/elements/Icon';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';

interface State {
    hasError: boolean;
}

const ErrorBox = styled.div`
    ${tw`flex items-center p-3 text-red-500`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
`;

// eslint-disable-next-line @typescript-eslint/ban-types
class ErrorBoundary extends React.Component<{}, State> {
    state: State = {
        hasError: false,
    };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error(error);
    }

    render() {
        return this.state.hasError ? (
            <div css={tw`flex items-center justify-center w-full my-4`}>
                <ErrorBox>
                    <Icon icon={faExclamationTriangle} css={tw`h-4 w-auto mr-2`} />
                    <p css={tw`text-sm`} style={{ color: 'var(--color-base)' }}>
                        An error was encountered by the application while rendering this view. Try refreshing the page.
                    </p>
                </ErrorBox>
            </div>
        ) : (
            this.props.children
        );
    }
}

export default ErrorBoundary;
