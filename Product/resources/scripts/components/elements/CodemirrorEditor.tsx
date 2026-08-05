import React, { lazy, Suspense } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import CodeMirror from 'codemirror';
import Spinner from '@/components/elements/Spinner';

const CodeMirrorEditorImpl = lazy(() => import('@/components/elements/CodeMirrorEditorImpl'));
const MonacoEditor = lazy(() => import('@/components/elements/MonacoEditor'));

const LoadingContainer = styled.div`
    min-height: 16rem;
    height: calc(100vh - 20rem);
    ${tw`relative flex items-center justify-center`};
`;

export interface Props {
    style?: React.CSSProperties;
    initialContent?: string;
    mode: string;
    filename?: string;
    onModeChanged: (mode: string) => void;
    fetchContent: (callback: () => Promise<string>) => void;
    onContentSaved: () => void;
    onContentChanged?: (content: string) => void;
    onEditorReady?: (editor: CodeMirror.Editor) => void;
}

export default (props: Props) => {
    const fileEditorType = useStoreState((state: ApplicationStore) => state.settings.data?.advanced?.fileEditorType);

    if (fileEditorType === 'monaco') {
        return (
            <Suspense
                fallback={
                    <LoadingContainer style={props.style}>
                        <Spinner size={'large'} centered />
                    </LoadingContainer>
                }
            >
                <MonacoEditor {...props} />
            </Suspense>
        );
    }

    return (
        <Suspense
            fallback={
                <LoadingContainer style={props.style}>
                    <Spinner size={'large'} centered />
                </LoadingContainer>
            }
        >
            <CodeMirrorEditorImpl {...props} />
        </Suspense>
    );
};
