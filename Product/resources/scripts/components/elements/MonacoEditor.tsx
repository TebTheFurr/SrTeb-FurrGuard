import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import modes from '@/modes';

const EditorContainer = styled.div`
    min-height: 16rem;
    height: calc(100vh - 20rem);
    ${tw`relative`};

    > div {
        ${tw`rounded h-full`};
    }
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
    onEditorReady?: (editor: any) => void;
}

const findModeByFilename = (filename: string) => {
    for (let i = 0; i < modes.length; i++) {
        const info = modes[i];

        if (info.file && info.file.test(filename)) {
            return info;
        }
    }

    const dot = filename.lastIndexOf('.');
    const ext = dot > -1 && filename.substring(dot + 1, filename.length);

    if (ext) {
        for (let i = 0; i < modes.length; i++) {
            const info = modes[i];
            if (info.ext) {
                for (let j = 0; j < info.ext.length; j++) {
                    if (info.ext[j] === ext) {
                        return info;
                    }
                }
            }
        }
    }

    return undefined;
};

const mimeToMonacoLanguage = (mime: string): string => {
    const mimeToLangMap: Record<string, string> = {
        'application/json': 'json',
        'application/x-httpd-php': 'php',
        'text/css': 'css',
        'text/html': 'html',
        'text/javascript': 'javascript',
        'text/typescript': 'typescript',
        'text/typescript-jsx': 'typescript',
        'text/x-csrc': 'c',
        'text/x-c++src': 'cpp',
        'text/x-go': 'go',
        'text/x-java': 'java',
        'text/x-properties': 'ini',
        'text/x-python': 'python',
        'text/x-rustsrc': 'rust',
        'text/x-sh': 'shell',
        'text/x-scss': 'scss',
        'text/xml': 'xml',
        'text/yaml': 'yaml',
        'application/xml': 'xml',
        'text/markdown': 'markdown',
        'text/x-markdown': 'markdown',
        'application/sql': 'sql',
        'text/x-sql': 'sql',
        'text/x-toml': 'toml',
        'text/x-dockerfile': 'dockerfile',
        'application/x-sh': 'shell',
        'text/x-shellscript': 'shell',
        'python': 'python',
        'javascript': 'javascript',
        'jsx': 'javascript',
        'php': 'php',
        'yaml': 'yaml',
        'shell': 'shell',
        'markdown': 'markdown',
        'rust': 'rust',
        'toml': 'toml',
        'sql': 'sql',
        'xml': 'xml',
    };

    return mimeToLangMap[mime] || 'plaintext';
};

export default ({
    style,
    initialContent,
    filename,
    mode,
    fetchContent,
    onContentSaved,
    onModeChanged,
    onContentChanged,
    onEditorReady,
}: Props) => {
    const editorRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState(() => mimeToMonacoLanguage(mode));
    const fetchContentRef = useRef(fetchContent);
    const onContentSavedRef = useRef(onContentSaved);

    fetchContentRef.current = fetchContent;
    onContentSavedRef.current = onContentSaved;

    useEffect(() => {
        if (filename === undefined) {
            return;
        }

        onModeChanged(findModeByFilename(filename)?.mime || 'text/plain');
    }, [filename]);

    useEffect(() => {
        const newLanguage = mimeToMonacoLanguage(mode);
        if (editorRef.current && isReady) {
            const model = editorRef.current.getModel();
            if (model) {
                const monaco = (window as any).monaco;
                if (monaco) {
                    monaco.editor.setModelLanguage(model, newLanguage);
                }
            }
        }
        setCurrentLanguage(newLanguage);
    }, [mode, isReady]);

    useEffect(() => {
        if (!editorRef.current || !isReady || initialContent === undefined) {
            return;
        }

        const currentValue = editorRef.current.getValue();
        if (currentValue !== initialContent) {
            editorRef.current.setValue(initialContent);
        }
    }, [initialContent, isReady]);

    useEffect(() => {
        if (!editorRef.current || !isReady) {
            fetchContentRef.current(() => Promise.reject(new Error('no editor session has been configured')));
            return;
        }

        fetchContentRef.current(() => Promise.resolve(editorRef.current.getValue()));
    }, [isReady]);

    useEffect(() => {
        if (!editorRef.current || !isReady || !onContentChanged) {
            return;
        }

        const disposable = editorRef.current.onDidChangeModelContent(() => {
            onContentChanged(editorRef.current.getValue());
        });

        return () => disposable.dispose();
    }, [isReady, onContentChanged]);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        setIsReady(true);

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            onContentSavedRef.current();
        });

        const changeListeners: Array<() => void> = [];

        const compatibleEditor = {
            ...editor,
            getValue: () => editor.getValue(),
            setValue: (value: string) => {
                editor.setValue(value);
                editor.setSelection({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: 1,
                    endColumn: 1,
                });
            },
            on: (event: string, handler: () => void) => {
                if (event === 'change') {
                    changeListeners.push(handler);
                    const disposable = editor.onDidChangeModelContent(() => {
                        handler();
                    });
                    return disposable;
                }
            },
            off: (event: string, handler: () => void) => {
                if (event === 'change') {
                    const index = changeListeners.indexOf(handler);
                    if (index > -1) {
                        changeListeners.splice(index, 1);
                    }
                }
            },
            setHistory: () => {
            },
        };

        if (onEditorReady) {
            onEditorReady(compatibleEditor);
        }
    };

    return (
        <EditorContainer style={style}>
            <Editor
                height="100%"
                language={currentLanguage}
                defaultValue={initialContent || ''}
                theme="vs-dark"
                onMount={handleEditorDidMount}
                loading={null}
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    wordWrap: 'on',
                    renderWhitespace: 'selection',
                    folding: true,
                    lineDecorationsWidth: 10,
                    lineNumbersMinChars: 3,
                    glyphMargin: false,
                    scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        useShadows: false,
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                    },
                }}
            />
        </EditorContainer>
    );
};
