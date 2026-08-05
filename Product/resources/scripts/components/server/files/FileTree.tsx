import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown, faFolder, faFolderOpen, faFileAlt, faFileCode, faFileArchive, faLock } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FileObject } from '@/api/server/files/loadDirectory';
import loadDirectory from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';

interface FileTreeProps {
    onFileSelect: (path: string, name: string) => void;
    selectedFile: string | null;
    refreshKey?: number;
}

interface TreeNode {
    file: FileObject;
    path: string;
    children?: TreeNode[];
    isLoaded?: boolean;
    isExpanded?: boolean;
}

const TreeContainer = styled.div`
    ${tw`h-full overflow-y-auto`};
    padding: 0.5rem 0;
`;

const TreeItem = styled.div<{ $depth: number; $isSelected?: boolean; $isClickable?: boolean }>`
    ${tw`flex items-center select-none transition-colors duration-100`};
    padding: 0.35rem 0.5rem;
    padding-left: ${({ $depth }) => `${$depth * 1 + 0.5}rem`};
    font-size: 0.8125rem;
    cursor: ${props => props.$isClickable !== false ? 'pointer' : 'not-allowed'};
    color: ${props => props.$isSelected ? 'var(--color-base)' : 'color-mix(in srgb, var(--color-base) 70%, transparent)'};
    background-color: ${props => props.$isSelected ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'transparent'};

    &:hover {
        background-color: ${props => props.$isClickable !== false 
            ? (props.$isSelected 
                ? 'color-mix(in srgb, var(--color-primary) 25%, transparent)' 
                : 'var(--color-background)')
            : 'transparent'};
        color: ${props => props.$isClickable !== false ? 'var(--color-base)' : 'color-mix(in srgb, var(--color-base) 70%, transparent)'};   
    }
`;

const ChevronIcon = styled.span<{ $visible: boolean }>`
    ${tw`flex-shrink-0 mr-1`};
    width: 1rem;
    visibility: ${props => props.$visible ? 'visible' : 'hidden'};
    font-size: 0.625rem;
    color: var(--color-muted);
`;

const FileIcon = styled.span<{ $isFolder?: boolean }>`
    ${tw`flex-shrink-0 mr-2`};
    font-size: 0.875rem;
    color: ${({ $isFolder }) => $isFolder ? 'var(--color-primary)' : 'var(--color-muted)'};
`;

const FileName = styled.span`
    ${tw`truncate`};
`;

const LoadingIndicator = styled.div<{ $depth: number }>`
    ${tw`flex items-center`};
    padding: 0.35rem 0.5rem;
    padding-left: ${({ $depth }) => `${$depth + 2.5}rem`};
    font-size: 0.75rem;
    color: var(--color-muted);
`;

const isJarFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext === 'jar';
};

const getFileIcon = (file: FileObject) => {
    if (!file.isFile) {
        return faFolder;
    }
    if (file.isArchiveType()) {
        return faFileArchive;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'scss', 'html', 'xml', 'json', 'yml', 'yaml', 'sh', 'bash', 'php', 'rb', 'go', 'rs', 'swift', 'kt'];
    if (ext && codeExtensions.includes(ext)) {
        return faFileCode;
    }
    return faFileAlt;
};

const TreeNodeComponent: React.FC<{
    node: TreeNode;
    depth: number;
    onFileSelect: (path: string, name: string) => void;
    selectedFile: string | null;
    onToggle: (path: string) => void;
    loadingPaths: Set<string>;
}> = ({ node, depth, onFileSelect, selectedFile, onToggle, loadingPaths }) => {
    const isFolder = !node.file.isFile;
    const isSelected = selectedFile === node.path;
    const isLoading = loadingPaths.has(node.path);
    const isJar = isFolder ? false : isJarFile(node.file.name);
    const isClickable = !node.file.isRestricted && (isFolder || !isJar);

    const handleClick = () => {
        if (!isClickable) return;
        if (isFolder) {
            onToggle(node.path);
        } else {
            onFileSelect(node.path, node.file.name);
        }
    };

    return (
        <>
            <TreeItem $depth={depth} $isSelected={isSelected} $isClickable={isClickable} onClick={handleClick}>
                <ChevronIcon $visible={isFolder}>
                    <FontAwesomeIcon icon={node.isExpanded ? faChevronDown : faChevronRight} />
                </ChevronIcon>
                <FileIcon $isFolder={isFolder}>
                    <FontAwesomeIcon icon={node.file.isRestricted ? faLock : isFolder && node.isExpanded ? faFolderOpen : getFileIcon(node.file)} />
                </FileIcon>
                <FileName>{node.file.name}</FileName>
            </TreeItem>
            {isFolder && node.isExpanded && (
                <>
                    {isLoading ? (
                        <LoadingIndicator $depth={depth + 1}>
                            <Spinner size="small" />
                        </LoadingIndicator>
                    ) : (
                        node.children?.map((child) => (
                            <TreeNodeComponent
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                onFileSelect={onFileSelect}
                                selectedFile={selectedFile}
                                onToggle={onToggle}
                                loadingPaths={loadingPaths}
                            />
                        ))
                    )}
                </>
            )}
        </>
    );
};

const FileTree: React.FC<FileTreeProps> = ({ onFileSelect, selectedFile, refreshKey }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [initialLoading, setInitialLoading] = useState(true);

    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
        return [...nodes].sort((a, b) => {
            if (a.file.isFile !== b.file.isFile) {
                return a.file.isFile ? 1 : -1;
            }
            return a.file.name.localeCompare(b.file.name);
        });
    };

    const loadRootDirectory = useCallback(async () => {
        setInitialLoading(true);
        try {
            const files = await loadDirectory(uuid, '/');
            const nodes: TreeNode[] = files
                .filter((file) => file.name !== '.trash')
                .map((file) => ({
                    file,
                    path: '/' + file.name,
                    isExpanded: false,
                    isLoaded: false,
                }));
            setRootNodes(sortNodes(nodes));
        } catch (error) {
            console.error('Failed to load root directory:', error);
        } finally {
            setInitialLoading(false);
        }
    }, [uuid]);

    useEffect(() => {
        loadRootDirectory();
    }, [loadRootDirectory, refreshKey]);

    const loadChildren = useCallback(async (path: string) => {
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
            const files = await loadDirectory(uuid, path);
            const children: TreeNode[] = files.map((file) => ({
                file,
                path: path + '/' + file.name,
                isExpanded: false,
                isLoaded: false,
            }));
            return sortNodes(children);
        } catch (error) {
            console.error('Failed to load directory:', error);
            return [];
        } finally {
            setLoadingPaths((prev) => {
                const next = new Set(prev);
                next.delete(path);
                return next;
            });
        }
    }, [uuid]);

    const updateNodeInTree = (nodes: TreeNode[], path: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
        return nodes.map((node) => {
            if (node.path === path) {
                return updater(node);
            }
            if (node.children && path.startsWith(node.path + '/')) {
                return {
                    ...node,
                    children: updateNodeInTree(node.children, path, updater),
                };
            }
            return node;
        });
    };

    const handleToggle = async (path: string) => {
        const findNode = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
            for (const node of nodes) {
                if (node.path === targetPath) return node;
                if (node.children) {
                    const found = findNode(node.children, targetPath);
                    if (found) return found;
                }
            }
            return null;
        };

        const node = findNode(rootNodes, path);
        if (!node) return;

        if (!node.isLoaded) {
            const children = await loadChildren(path);
            setRootNodes((prev) =>
                updateNodeInTree(prev, path, (n) => ({
                    ...n,
                    children,
                    isLoaded: true,
                    isExpanded: true,
                }))
            );
        } else {
            setRootNodes((prev) =>
                updateNodeInTree(prev, path, (n) => ({
                    ...n,
                    isExpanded: !n.isExpanded,
                }))
            );
        }
    };

    if (initialLoading) {
        return (
            <TreeContainer>
                <div className="flex items-center justify-center py-8">
                    <Spinner size="base" />
                </div>
            </TreeContainer>
        );
    }

    return (
        <TreeContainer>
            {rootNodes.map((node) => (
                <TreeNodeComponent
                    key={node.path}
                    node={node}
                    depth={0}
                    onFileSelect={onFileSelect}
                    selectedFile={selectedFile}
                    onToggle={handleToggle}
                    loadingPaths={loadingPaths}
                />
            ))}
        </TreeContainer>
    );
};

export default FileTree;
