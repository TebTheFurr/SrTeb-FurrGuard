import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faSave, faPlus, faSync, faUpload, faTrash, faFileAlt, faUndo } from '@fortawesome/free-solid-svg-icons';
import TrashCanModal from './TrashCanModal';
import FileTree from './FileTree';
import FileTabs, { OpenTab } from './FileTabs';
import { ServerContext } from '@/state/server';
import getFileContents from '@/api/server/files/getFileContents';
import http from '@/api/http';
import saveFileContents from '@/api/server/files/saveFileContents';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Spinner from '@/components/elements/Spinner';
import { useFlashKey } from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import modes from '@/modes';
import Select from '@/components/elements/Select';
import { Button } from '@/components/elements/button/index';
import FileNameModal from './FileNameModal';
import { usePersistedState } from '@/plugins/usePersistedState';
import Portal from '@/components/elements/Portal';
import Fade from '@/components/elements/Fade';
import { ModalMask } from '@/components/elements/Modal';
import { useStoreState } from 'easy-peasy';

const IDEContainer = styled.div`
    ${tw`flex`};
    height: calc(100vh - 14rem);
    min-height: 500px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    overflow: hidden;
`;

const Sidebar = styled.div`
    ${tw`flex flex-col flex-shrink-0`};
    width: 260px;
    border-right: 1px solid var(--color-neutral);
    background-color: var(--color-background-secondary);
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between px-3 py-2`};
    border-bottom: 1px solid var(--color-neutral);
    background-color: var(--color-background);
`;

const SidebarTitle = styled.span`
    ${tw`text-xs font-medium uppercase tracking-wider`};
    color: var(--color-muted);
`;

const SidebarActions = styled.div`
    ${tw`flex items-center gap-1`};
`;

const IconButton = styled.button`
    ${tw`flex items-center justify-center transition-colors duration-100`};
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-muted);
    background: transparent;
    border: none;

    &:hover {
        background-color: var(--color-background-secondary);
        color: var(--color-base);
    }
`;

const SidebarContent = styled.div`
    ${tw`flex-1 overflow-hidden`};
`;

const MainArea = styled.div`
    ${tw`flex-1 flex flex-col min-w-0`};
    min-height: 0;
    background-color: var(--color-background);
`;

const Breadcrumbs = styled.div`
    ${tw`flex items-center text-xs px-4 py-2`};
    background-color: var(--color-background-secondary);
    border-bottom: 1px solid var(--color-neutral);
    color: var(--color-muted);
    overflow-x: auto;
    white-space: nowrap;
    
    &::-webkit-scrollbar {
        height: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: var(--color-neutral);
        border-radius: 2px;
    }
`;

const BreadcrumbSeparator = styled.span`
    ${tw`mx-1`};
    color: var(--color-neutral);
`;

const BreadcrumbItem = styled.span<{ $isLast?: boolean }>`
    color: ${({ $isLast }) => $isLast ? 'var(--color-base)' : 'var(--color-muted)'};
    font-weight: ${({ $isLast }) => $isLast ? '500' : '400'};
`;

const EditorArea = styled.div`
    ${tw`flex-1 flex flex-col overflow-hidden`};
    min-height: 0;
`;

const EditorContent = styled.div`
    ${tw`flex-1`};
    position: relative;
    overflow: hidden;
    min-height: 300px;
    
    .CodeMirror {
        height: 100% !important;
    }
`;

const EditorFooter = styled.div`
    ${tw`flex items-center justify-between px-4 py-2`};
    background-color: var(--color-background-secondary);
    border-top: 1px solid var(--color-neutral);
`;

const EmptyEditor = styled.div`
    ${tw`flex flex-col items-center justify-center h-full`};
    color: var(--color-muted);
`;

const EmptyIcon = styled.div`
    ${tw`mb-4`};
    font-size: 3rem;
    opacity: 0.3;
`;

const EmptyText = styled.p`
    ${tw`text-sm`};
`;

interface FileContent {
    content: string;
    originalContent: string;
    mode: string;
    isLoading: boolean;
    isImage?: boolean;
    imageUrl?: string;
    isInvalidUTF8?: boolean;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'];

const isImageFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
};

const isJarFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext === 'jar';
};

const getFileContentsAsArrayBuffer = (server: string, file: string): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${server}/files/contents`, {
            params: { file },
            transformResponse: (res) => res,
            responseType: 'arraybuffer',
        })
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

const isValidUTF8 = (buffer: ArrayBuffer): { valid: boolean; content?: string } => {
    try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const content = decoder.decode(buffer);
        return { valid: true, content };
    } catch {
        return { valid: false };
    }
};

const ImagePreviewContainer = styled.div`
    ${tw`flex flex-col items-center justify-center h-full w-full p-8`};
    background-color: var(--color-background-secondary);
    overflow: auto;
`;

const ImagePreview = styled.img`
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 0.5rem;
`;

const FileManagerIDE: React.FC = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const { clearAndAddHttpError, clearFlashes, addError } = useFlashKey('files:ide');
    
    const { clearFileUploads, removeFileUpload, pushFileUpload, setUploadProgress } = ServerContext.useStoreActions(
        (actions) => actions.files
    );
    
    const [openTabs, setOpenTabs] = usePersistedState<OpenTab[]>(`${serverId}:ide_open_tabs`, []);
    const [activeTab, setActiveTab] = usePersistedState<string | null>(`${serverId}:ide_active_tab`, null);
    const [fileContents, setFileContents] = useState<Map<string, FileContent>>(new Map());
    const [saving, setSaving] = useState(false);
    const [newFileModalVisible, setNewFileModalVisible] = useState(false);
    const [treeRefreshKey, setTreeRefreshKey] = useState(0);
    const [dragVisible, setDragVisible] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const trashEnabled = useStoreState((state) => state.settings.data?.components?.trashEnabled ?? true);
    
    const fetchContentRef = useRef<Map<string, () => Promise<string>>>(new Map());
    const editorRefsRef = useRef<Map<string, any>>(new Map());
    const editorListenersRef = useRef<Map<string, () => void>>(new Map());
    const loadingPathsRef = useRef<Set<string>>(new Set());
    const fileUploadRef = useRef<HTMLInputElement>(null);
    const uploadTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
    const initialValidationDoneRef = useRef(false);
    const activeTabRef = useRef<string | null>(null);
    const updateTabModifiedStateRef = useRef<(path: string, currentContent: string) => void>();
    const loadFileContentRef = useRef<(path: string, name: string) => void>();

    const getModeForFile = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const modeMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'jsx',
            'ts': 'text/typescript',
            'tsx': 'text/typescript-jsx',
            'json': 'application/json',
            'html': 'text/html',
            'css': 'text/css',
            'scss': 'text/x-scss',
            'py': 'python',
            'php': 'php',
            'yml': 'yaml',
            'yaml': 'yaml',
            'xml': 'xml',
            'md': 'markdown',
            'sh': 'shell',
            'bash': 'shell',
            'sql': 'sql',
            'java': 'text/x-java',
            'c': 'text/x-csrc',
            'cpp': 'text/x-c++src',
            'h': 'text/x-csrc',
            'go': 'text/x-go',
            'rs': 'rust',
            'rb': 'ruby',
            'properties': 'text/x-properties',
            'toml': 'toml',
            'ini': 'text/x-properties',
            'conf': 'text/x-properties',
            'cfg': 'text/x-properties',
            'txt': 'text/plain',
            'log': 'text/plain',
        };
        return modeMap[ext] || 'text/plain';
    };

    const getUploadDirectory = useCallback(() => {
        if (!activeTab) return '/';
        const parts = activeTab.split('/');
        parts.pop();
        return parts.join('/') || '/';
    }, [activeTab]);

    const onUploadProgress = (data: AxiosProgressEvent, name: string) => {
        setUploadProgress({ name, loaded: data.loaded });
    };

    const onFileSubmission = useCallback((files: FileList) => {
        clearAndAddHttpError();
        const list = Array.from(files);
        if (list.some((file) => !file.type && (!file.size || file.size === 4096))) {
            return addError('Folder uploads are not supported.', 'Error');
        }

        const directory = getUploadDirectory();
        
        const uploads = list.map((file) => {
            const controller = new AbortController();
            pushFileUpload({
                name: file.name,
                data: { abort: controller, loaded: 0, total: file.size },
            });

            return () =>
                getFileUploadUrl(uuid).then((url) =>
                    axios
                        .post(
                            url,
                            { files: file },
                            {
                                signal: controller.signal,
                                headers: { 'Content-Type': 'multipart/form-data' },
                                params: { directory },
                                onUploadProgress: (data) => onUploadProgress(data, file.name),
                            }
                        )
                        .then(() => uploadTimeoutsRef.current.push(setTimeout(() => removeFileUpload(file.name), 500)))
                );
        });

        Promise.all(uploads.map((fn) => fn()))
            .then(() => setTreeRefreshKey((k) => k + 1))
            .catch((error) => {
                clearFileUploads();
                clearAndAddHttpError(error);
            });
    }, [uuid, getUploadDirectory, clearAndAddHttpError, addError, pushFileUpload, removeFileUpload, clearFileUploads, setUploadProgress]);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer?.types.some((t) => t.toLowerCase() === 'files')) {
            setDragVisible(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragVisible(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragVisible(false);
        if (e.dataTransfer?.files.length) {
            onFileSubmission(e.dataTransfer.files);
        }
    }, [onFileSubmission]);

    const closeTabsForPaths = useCallback((paths: string[]) => {
        const pathsSet = new Set(paths);
        
        setOpenTabs((prev) => {
            const newTabs = prev.filter((tab) => !pathsSet.has(tab.path));
            
            if (activeTab && pathsSet.has(activeTab)) {
                const closedIndex = prev.findIndex((tab) => pathsSet.has(tab.path));
                const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
                const newActiveTab = newTabs[newActiveIndex];
                setActiveTab(newActiveTab?.path || null);
                
                if (newActiveTab && !fileContents.has(newActiveTab.path)) {
                    loadFileContentRef.current?.(newActiveTab.path, newActiveTab.name);
                }
            }
            
            return newTabs;
        });
        
        setFileContents((prev) => {
            const next = new Map(prev);
            paths.forEach((path) => {
                next.delete(path);
                fetchContentRef.current.delete(path);
            });
            return next;
        });
    }, [activeTab, fileContents]);

    const loadFileContent = useCallback(async (path: string, name: string) => {
        if (loadingPathsRef.current.has(path)) {
            return;
        }
        
        loadingPathsRef.current.add(path);
        
        const isImage = isImageFile(name);
        const isJar = isJarFile(name);
        
        setFileContents((prev) => {
            const next = new Map(prev);
            next.set(path, {
                content: '',
                originalContent: '',
                mode: getModeForFile(name),
                isLoading: true,
                isImage,
            });
            return next;
        });

        try {
            if (isImage) {
                const imageUrl = await getFileDownloadUrl(uuid, path);
                setFileContents((prev) => {
                    const next = new Map(prev);
                    next.set(path, {
                        content: '',
                        originalContent: '',
                        mode: getModeForFile(name),
                        isLoading: false,
                        isImage: true,
                        imageUrl,
                    });
                    return next;
                });
            } else {
                if (isJar) {
                    const buffer = await getFileContentsAsArrayBuffer(uuid, path);
                    const validation = isValidUTF8(buffer);
                    
                    if (!validation.valid) {
                        setFileContents((prev) => {
                            const next = new Map(prev);
                            next.set(path, {
                                content: '',
                                originalContent: '',
                                mode: getModeForFile(name),
                                isLoading: false,
                                isInvalidUTF8: true,
                            });
                            return next;
                        });
                        addError('This .jar file contains non-UTF-8 content and cannot be displayed as text.', 'Invalid Encoding');
                    } else {
                        setFileContents((prev) => {
                            const next = new Map(prev);
                            next.set(path, {
                                content: validation.content || '',
                                originalContent: validation.content || '',
                                mode: getModeForFile(name),
                                isLoading: false,
                            });
                            return next;
                        });
                    }
                } else {
                    const content = await getFileContents(uuid, path);
                    setFileContents((prev) => {
                        const next = new Map(prev);
                        next.set(path, {
                            content,
                            originalContent: content,
                            mode: getModeForFile(name),
                            isLoading: false,
                        });
                        return next;
                    });
                }
            }
        } catch (error: any) {
            const isNotFound = error?.response?.status === 404 || 
                             error?.response?.status === 410 ||
                             (typeof error?.response?.data === 'string' && error.response.data.toLowerCase().includes('not found')) ||
                             (error?.response?.data?.errors?.[0]?.detail?.toLowerCase().includes('not found'));
            
            if (isNotFound) {
                closeTabsForPaths([path]);
            } else {
                clearAndAddHttpError(error as Error);
                setFileContents((prev) => {
                    const next = new Map(prev);
                    next.delete(path);
                    return next;
                });
            }
        } finally {
            loadingPathsRef.current.delete(path);
        }
    }, [uuid, clearAndAddHttpError, addError, closeTabsForPaths]);

    const handleFileSelect = useCallback((path: string, name: string) => {
        const existingTab = openTabs?.find((tab) => tab.path === path);
        const hasContent = fileContents.has(path);
        
        if (!existingTab) {
            setOpenTabs((prev) => [...(prev || []), { path, name }]);
        }
        
        setActiveTab(path);
        
        if (!hasContent) {
            loadFileContent(path, name);
        }
    }, [openTabs, fileContents, loadFileContent]);

    const updateTabModifiedState = useCallback((path: string, currentContent: string) => {
        setOpenTabs((prev) => {
            const tab = prev.find((t) => t.path === path);
            if (!tab) return prev;
            
            const fileContent = fileContents.get(path);
            if (!fileContent) return prev;
            
            const isModified = currentContent !== fileContent.originalContent;
            if (tab.isModified === isModified) return prev;
            
            return prev.map((t) =>
                t.path === path ? { ...t, isModified } : t
            );
        });
    }, [fileContents]);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    useEffect(() => {
        updateTabModifiedStateRef.current = updateTabModifiedState;
    }, [updateTabModifiedState]);

    useEffect(() => {
        loadFileContentRef.current = loadFileContent;
    }, [loadFileContent]);

    const handleTabSelect = useCallback(async (path: string) => {
        if (activeTab && activeTab !== path) {
            const fetchContent = fetchContentRef.current.get(activeTab);
            if (fetchContent) {
                try {
                    const currentContent = await fetchContent();
                    setFileContents((prev) => {
                        const next = new Map(prev);
                        const current = next.get(activeTab);
                        if (current) {
                            next.set(activeTab, { ...current, content: currentContent });
                        }
                        return next;
                    });
                    updateTabModifiedState(activeTab, currentContent);
                } catch (e) {
                }
            }
        }
        setActiveTab(path);
        
        if (!fileContents.has(path)) {
            const tab = openTabs?.find((t) => t.path === path);
            if (tab) {
                loadFileContent(path, tab.name);
            }
        }
    }, [activeTab, updateTabModifiedState, fileContents, openTabs, loadFileContent]);

    const handleTabClose = useCallback((path: string) => {
        const listener = editorListenersRef.current.get(path);
        if (listener) {
            listener();
            editorListenersRef.current.delete(path);
        }
        editorRefsRef.current.delete(path);
        closeTabsForPaths([path]);
    }, [closeTabsForPaths]);

    const handleEditorReady = useCallback((editor: any) => {
        const path = activeTabRef.current;
        if (!path) return;

        const existingListener = editorListenersRef.current.get(path);
        if (existingListener) {
            existingListener();
        }

        editorRefsRef.current.set(path, editor);

        let isActive = true;
        const changeHandler = () => {
            const currentPath = activeTabRef.current;
            if (!isActive || !currentPath) return;
            const currentContent = editor.getValue();
            updateTabModifiedStateRef.current?.(currentPath, currentContent);
        };

        editor.on('change', changeHandler);

        const off = () => {
            isActive = false;
            try {
                if (editor.off) {
                    editor.off('change', changeHandler);
                }
            } catch (e) {
            }
        };

        editorListenersRef.current.set(path, off);
    }, []);

    const handleCloseAll = useCallback(() => {
        editorListenersRef.current.forEach((listener) => listener());
        editorListenersRef.current.clear();
        setOpenTabs([]);
        setActiveTab(null);
        setFileContents(new Map());
        fetchContentRef.current.clear();
        editorRefsRef.current.clear();
    }, []);

    const handleCancel = useCallback(() => {
        if (!activeTab) return;
        
        const fileContent = fileContents.get(activeTab);
        if (!fileContent) return;
        
        const editor = editorRefsRef.current.get(activeTab);
        if (editor) {
            editor.setValue(fileContent.originalContent);
            editor.setHistory({ done: [], undone: [] });
        }
        
        setFileContents((prev) => {
            const next = new Map(prev);
            const current = next.get(activeTab);
            if (current) {
                next.set(activeTab, {
                    ...current,
                    content: current.originalContent,
                });
            }
            return next;
        });
        
        setOpenTabs((prev) =>
            prev.map((tab) =>
                tab.path === activeTab ? { ...tab, isModified: false } : tab
            )
        );
    }, [activeTab, fileContents]);

    const handleSave = useCallback(async () => {
        if (!activeTab) return;
        
        const fetchContent = fetchContentRef.current.get(activeTab);
        if (!fetchContent) return;

        setSaving(true);
        clearFlashes();

        try {
            const content = await fetchContent();
            await saveFileContents(uuid, activeTab, content);
            
            setFileContents((prev) => {
                const next = new Map(prev);
                const current = next.get(activeTab);
                if (current) {
                    next.set(activeTab, {
                        ...current,
                        originalContent: content,
                        content,
                    });
                }
                return next;
            });
            
            setOpenTabs((prev) =>
                prev.map((tab) =>
                    tab.path === activeTab ? { ...tab, isModified: false } : tab
                )
            );
            
            setTreeRefreshKey((k) => k + 1);
        } catch (error) {
            clearAndAddHttpError(error as Error);
        } finally {
            setSaving(false);
        }
    }, [activeTab, uuid, clearFlashes, clearAndAddHttpError]);

    const handleNewFile = useCallback((name: string) => {
        const path = name.startsWith('/') ? name : '/' + name;
        const fileName = path.split('/').pop() || name;
        setOpenTabs((prev) => [...prev, { path, name: fileName, isModified: true }]);
        setActiveTab(path);
        setFileContents((prev) => {
            const next = new Map(prev);
            next.set(path, {
                content: '',
                originalContent: '',
                mode: getModeForFile(fileName),
                isLoading: false,
            });
            return next;
        });
        setNewFileModalVisible(false);
    }, []);

    const activeContent = activeTab ? fileContents.get(activeTab) : null;
    const activeTabData = openTabs?.find((tab) => tab.path === activeTab);

    const getBreadcrumbs = () => {
        if (!activeTab) return [];
        return activeTab.split('/').filter(Boolean);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    useEffect(() => {
        if (initialValidationDoneRef.current) return;
        
        if (!openTabs || openTabs.length === 0) {
            initialValidationDoneRef.current = true;
            return;
        }
        
        initialValidationDoneRef.current = true;
        
        const pathsToCheck = openTabs.map((tab) => tab.path);
        const currentActiveTab = activeTab;
        
        Promise.all(
            pathsToCheck.map(async (path) => {
                const tab = openTabs.find((t) => t.path === path);
                if (!tab) return { path, exists: false };
                
                try {
                    if (isImageFile(tab.name)) {
                        await getFileDownloadUrl(uuid, path);
                    } else {
                        await getFileContents(uuid, path);
                    }
                    return { path, exists: true };
                } catch (error: any) {
                    const isNotFound = error?.response?.status === 404 || 
                                     error?.response?.status === 410 ||
                                     (typeof error?.response?.data === 'string' && error.response.data.toLowerCase().includes('not found')) ||
                                     (error?.response?.data?.errors?.[0]?.detail?.toLowerCase().includes('not found'));
                    return { path, exists: !isNotFound };
                }
            })
        ).then((results) => {
            const missingPaths = results.filter((r) => !r.exists).map((r) => r.path);
            if (missingPaths.length > 0) {
                closeTabsForPaths(missingPaths);
            }
            
            const remainingTabs = openTabs.filter((tab) => !missingPaths.includes(tab.path));
            const newActiveTab = currentActiveTab && !missingPaths.includes(currentActiveTab) 
                ? currentActiveTab 
                : (remainingTabs.length > 0 ? remainingTabs[0].path : null);
            
            if (newActiveTab !== currentActiveTab) {
                setActiveTab(newActiveTab);
            }
            
            if (newActiveTab) {
                const tab = remainingTabs.find((t) => t.path === newActiveTab);
                if (tab) {
                    loadFileContent(newActiveTab, tab.name);
                }
            }
        });
    }, [openTabs, activeTab, uuid, closeTabsForPaths, loadFileContent]);

    useEffect(() => {
        return () => uploadTimeoutsRef.current.forEach(clearTimeout);
    }, []);

    return (
        <>
            <FlashMessageRender byKey="files:ide" className="mb-4" />
            <FileNameModal
                visible={newFileModalVisible}
                onDismissed={() => setNewFileModalVisible(false)}
                onFileNamed={handleNewFile}
            />
            {trashEnabled && (
                <TrashCanModal
                    visible={showTrash}
                    onDismissed={() => setShowTrash(false)}
                    onRestored={() => setTreeRefreshKey((k) => k + 1)}
                />
            )}
            <Portal>
                <Fade appear in={dragVisible} timeout={75} unmountOnExit>
                    <ModalMask
                        onClick={() => setDragVisible(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <div className="w-full flex items-center justify-center pointer-events-none">
                            <div
                                className="flex items-center space-x-4 w-full p-6 mx-10 max-w-sm"
                                style={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    border: '2px dashed var(--color-primary)',
                                    borderRadius: 'var(--border-radius, 8px)',
                                }}
                            >
                                <FontAwesomeIcon icon={faUpload} className="text-3xl" style={{ color: 'var(--color-primary)' }} />
                                <p className="flex-1 text-lg text-center" style={{ color: 'var(--color-base)' }}>
                                    Drop files to upload to {getUploadDirectory()}
                                </p>
                            </div>
                        </div>
                    </ModalMask>
                </Fade>
            </Portal>
            <input
                type="file"
                ref={fileUploadRef}
                className="hidden"
                onChange={(e) => {
                    if (e.currentTarget.files) {
                        onFileSubmission(e.currentTarget.files);
                        if (fileUploadRef.current) {
                            fileUploadRef.current.value = '';
                        }
                    }
                }}
                multiple
            />
            <IDEContainer
                onDragEnter={handleDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <Sidebar>
                    <SidebarHeader>
                        <SidebarTitle>
                            <FontAwesomeIcon icon={faFolderOpen} className="mr-2" />
                        </SidebarTitle>
                        <SidebarActions>
                            <IconButton onClick={() => setTreeRefreshKey((k) => k + 1)} title="Refresh">
                                <FontAwesomeIcon icon={faSync} />
                            </IconButton>
                            {trashEnabled && (
                                <IconButton onClick={() => setShowTrash(true)} title="Trash">
                                    <FontAwesomeIcon icon={faTrash} />
                                </IconButton>
                            )}
                            <Can action="file.create">
                                <IconButton onClick={() => fileUploadRef.current?.click()} title="Upload">
                                    <FontAwesomeIcon icon={faUpload} />
                                </IconButton>
                                <IconButton onClick={() => setNewFileModalVisible(true)} title="New File">
                                    <FontAwesomeIcon icon={faPlus} />
                                </IconButton>
                            </Can>
                        </SidebarActions>
                    </SidebarHeader>
                    <SidebarContent>
                        <FileTree onFileSelect={handleFileSelect} selectedFile={activeTab} refreshKey={treeRefreshKey} />
                    </SidebarContent>
                </Sidebar>
                <MainArea>
                    {activeTab && (
                        <Breadcrumbs>
                            <BreadcrumbItem>home</BreadcrumbItem>
                            <BreadcrumbSeparator>/</BreadcrumbSeparator>
                            <BreadcrumbItem>container</BreadcrumbItem>
                            {getBreadcrumbs().map((segment, index, arr) => (
                                <React.Fragment key={index}>
                                    <BreadcrumbSeparator>/</BreadcrumbSeparator>
                                    <BreadcrumbItem $isLast={index === arr.length - 1}>
                                        {segment}
                                    </BreadcrumbItem>
                                </React.Fragment>
                            ))}
                        </Breadcrumbs>
                    )}
                    <FileTabs
                        tabs={openTabs}
                        activeTab={activeTab}
                        onTabSelect={handleTabSelect}
                        onTabClose={handleTabClose}
                        onCloseAll={handleCloseAll}
                    />
                    <EditorArea>
                        {!activeTab ? (
                            <EmptyEditor>
                                <EmptyIcon>
                                    <FontAwesomeIcon icon={faFolderOpen} />
                                </EmptyIcon>
                                <EmptyText>Select a file from the explorer to edit</EmptyText>
                            </EmptyEditor>
                        ) : !activeContent || activeContent.isLoading ? (
                            <EmptyEditor>
                                <Spinner size="large" />
                            </EmptyEditor>
                        ) : activeContent.isImage && activeContent.imageUrl ? (
                            <ImagePreviewContainer>
                                <ImagePreview src={activeContent.imageUrl} alt={activeTabData?.name || 'Image preview'} />
                            </ImagePreviewContainer>
                        ) : activeContent.isInvalidUTF8 ? (
                            <EmptyEditor>
                                <EmptyIcon>
                                    <FontAwesomeIcon icon={faFileAlt} />
                                </EmptyIcon>
                                <EmptyText>This file contains non-UTF-8 content and cannot be displayed as text.</EmptyText>
                            </EmptyEditor>
                        ) : (
                            <EditorContent>
                                <SpinnerOverlay visible={saving} />
                                <CodemirrorEditor
                                    key={activeTab}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: 'auto', minHeight: 'unset' }}
                                    mode={activeContent.mode || 'text/plain'}
                                    filename={activeTabData?.name || ''}
                                    onModeChanged={(mode) => {
                                        if (activeTab) {
                                            setFileContents((prev) => {
                                                const next = new Map(prev);
                                                const current = next.get(activeTab);
                                                if (current) {
                                                    next.set(activeTab, { ...current, mode });
                                                }
                                                return next;
                                            });
                                        }
                                    }}
                                    initialContent={activeContent.content}
                                    fetchContent={(fn) => {
                                        if (activeTab) {
                                            fetchContentRef.current.set(activeTab, fn);
                                        }
                                    }}
                                    onEditorReady={handleEditorReady}
                                    onContentSaved={handleSave}
                                />
                            </EditorContent>
                        )}
                    </EditorArea>
                    {activeTab && !activeContent?.isImage && (
                        <EditorFooter>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={activeContent?.mode || 'text/plain'}
                                    onChange={(e) => {
                                        if (activeTab) {
                                            setFileContents((prev) => {
                                                const next = new Map(prev);
                                                const current = next.get(activeTab);
                                                if (current) {
                                                    next.set(activeTab, { ...current, mode: e.currentTarget.value });
                                                }
                                                return next;
                                            });
                                        }
                                    }}
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                >
                                    {modes.map((mode) => (
                                        <option key={`${mode.name}_${mode.mime}`} value={mode.mime}>
                                            {mode.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeContent && activeContent.content !== activeContent.originalContent && (
                                    <Button onClick={handleCancel} variant={Button.Variants.Secondary}>
                                        <FontAwesomeIcon icon={faUndo} className="mr-2" />
                                        Cancel
                                    </Button>
                                )}
                                <Can action="file.update">
                                    <Button onClick={handleSave} disabled={saving}>
                                        <FontAwesomeIcon icon={faSave} className="mr-2" />
                                        Save
                                    </Button>
                                </Can>
                            </div>
                        </EditorFooter>
                    )}
                </MainArea>
            </IDEContainer>
        </>
    );
};

export default FileManagerIDE;
