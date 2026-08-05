import React, { useState, useEffect, useCallback } from 'react';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown, faFolder, faFolderOpen, faHome } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FileObject } from '@/api/server/files/loadDirectory';
import loadDirectory from '@/api/server/files/loadDirectory';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { Button } from '@/components/elements/button/index';
import renameFiles from '@/api/server/files/renameFiles';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';

interface TreeNode {
    name: string;
    path: string;
    children?: TreeNode[];
    isLoaded?: boolean;
    isExpanded?: boolean;
}

const TreeContainer = styled.div`
    ${tw`overflow-y-auto`};
    max-height: 320px;
    min-height: 200px;
    padding: 0.5rem 0;
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: 8px;
    margin-bottom: 1rem;
`;

const TreeItem = styled.div<{ $depth: number; $isSelected?: boolean }>`
    ${tw`flex items-center cursor-pointer select-none transition-colors duration-100`};
    padding: 0.5rem 0.75rem;
    padding-left: ${({ $depth }) => `${$depth * 1.25 + 0.75}rem`};
    font-size: 0.875rem;
    color: ${props => props.$isSelected ? 'var(--color-base)' : 'color-mix(in srgb, var(--color-base) 70%, transparent)'};
    background-color: ${props => props.$isSelected ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'transparent'};
    border-left: ${props => props.$isSelected ? '2px solid var(--color-primary)' : '2px solid transparent'};

    &:hover {
        background-color: ${props => props.$isSelected 
            ? 'color-mix(in srgb, var(--color-primary) 25%, transparent)' 
            : 'var(--color-background-secondary)'};
        color: var(--color-base);
    }
`;

const ChevronIcon = styled.span<{ $visible: boolean }>`
    ${tw`flex-shrink-0 mr-1.5`};
    width: 0.875rem;
    visibility: ${props => props.$visible ? 'visible' : 'hidden'};
    font-size: 0.625rem;
    color: var(--color-muted);
`;

const FolderIcon = styled.span`
    ${tw`flex-shrink-0 mr-2`};
    font-size: 0.875rem;
    color: var(--color-primary);
`;

const FolderName = styled.span`
    ${tw`truncate`};
`;

const LoadingIndicator = styled.div<{ $depth: number }>`
    ${tw`flex items-center gap-2`};
    padding: 0.5rem 0.75rem;
    padding-left: ${({ $depth }) => `${$depth * 1.25 + 2.5}rem`};
    font-size: 0.75rem;
    color: var(--color-muted);
`;

const SelectedPath = styled.div`
    ${tw`flex items-center gap-2 mb-4`};
    padding: 0.75rem 1rem;
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: 8px;
    font-size: 0.8125rem;
`;

const PathLabel = styled.span`
    color: var(--color-muted);
    flex-shrink: 0;
`;

const PathValue = styled.span`
    color: var(--color-primary);
    font-family: monospace;
    ${tw`truncate`};
`;

const ModalTitle = styled.h3`
    ${tw`text-lg font-medium mb-1`};
    color: var(--color-base);
`;

const ModalSubtitle = styled.p`
    ${tw`text-sm mb-4`};
    color: var(--color-muted);
`;

const ButtonRow = styled.div`
    ${tw`flex justify-end gap-2 mt-4`};
`;

const HelpText = styled.p`
    ${tw`text-xs mt-2`};
    color: var(--color-muted);
`;

type OwnProps = RequiredModalProps & { files: string[] };

const TreeNodeComponent: React.FC<{
    node: TreeNode;
    depth: number;
    selectedPath: string;
    onSelect: (path: string) => void;
    onToggle: (path: string) => void;
    onDoubleClick: (path: string) => void;
    loadingPaths: Set<string>;
}> = ({ node, depth, selectedPath, onSelect, onToggle, onDoubleClick, loadingPaths }) => {
    const isSelected = selectedPath === node.path;
    const isLoading = loadingPaths.has(node.path);

    const handleClick = () => {
        onSelect(node.path);
        if (!node.isExpanded || !node.isLoaded) {
            onToggle(node.path);
        }
    };

    const handleDoubleClick = () => {
        onDoubleClick(node.path);
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(node.path);
    };

    return (
        <>
            <TreeItem 
                $depth={depth} 
                $isSelected={isSelected} 
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
            >
                <ChevronIcon $visible={true} onClick={handleChevronClick}>
                    <FontAwesomeIcon icon={node.isExpanded ? faChevronDown : faChevronRight} />
                </ChevronIcon>
                <FolderIcon>
                    <FontAwesomeIcon icon={node.isExpanded ? faFolderOpen : faFolder} />
                </FolderIcon>
                <FolderName>{node.name}</FolderName>
            </TreeItem>
            {node.isExpanded && (
                <>
                    {isLoading ? (
                        <LoadingIndicator $depth={depth + 1}>
                            <Spinner size="small" />
                            <span>Loading...</span>
                        </LoadingIndicator>
                    ) : (
                        node.children?.map((child) => (
                            <TreeNodeComponent
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                onToggle={onToggle}
                                onDoubleClick={onDoubleClick}
                                loadingPaths={loadingPaths}
                            />
                        ))
                    )}
                </>
            )}
        </>
    );
};

const getRelativePath = (from: string, to: string): string => {
    const fromParts = from.split('/').filter(Boolean);
    const toParts = to.split('/').filter(Boolean);
    
    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength++;
        } else {
            break;
        }
    }
    
    const upCount = fromParts.length - commonLength;
    const downParts = toParts.slice(commonLength);
    
    const relativeParts: string[] = [];
    for (let i = 0; i < upCount; i++) {
        relativeParts.push('..');
    }
    relativeParts.push(...downParts);
    
    return relativeParts.length > 0 ? relativeParts.join('/') : '.';
};

const MoveFileModal = ({ files, ...props }: OwnProps) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    
    const [selectedPath, setSelectedPath] = useState('/');
    const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [initialLoading, setInitialLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
        return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
    };

    const loadRootDirectory = useCallback(async () => {
        setInitialLoading(true);
        try {
            const filesData = await loadDirectory(uuid, '/');
            const nodes: TreeNode[] = filesData
                .filter((file: FileObject) => !file.isFile)
                .map((file: FileObject) => ({
                    name: file.name,
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
        if (props.visible) {
            loadRootDirectory();
            setSelectedPath('/');
        }
    }, [loadRootDirectory, props.visible]);

    const loadChildren = useCallback(async (path: string): Promise<TreeNode[]> => {
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
            const filesData = await loadDirectory(uuid, path);
            const children: TreeNode[] = filesData
                .filter((file: FileObject) => !file.isFile)
                .map((file: FileObject) => ({
                    name: file.name,
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

    const handleMove = () => {
        setIsSubmitting(true);
        clearFlashes('files');

        const relativePath = getRelativePath(directory, selectedPath);
        
        const data = files.map((f) => ({
            from: f,
            to: relativePath === '.' ? f : `${relativePath}/${f}`,
        }));

        if (files.length === 1 && relativePath !== '.') {
            mutate((current) => current.filter((f) => f.name !== files[0]), false);
        }

        renameFiles(uuid, directory, data)
            .then((): Promise<any> => (files.length > 0 ? mutate() : Promise.resolve()))
            .then(() => setSelectedFiles([]))
            .catch((error) => {
                mutate();
                setIsSubmitting(false);
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => props.onDismissed());
    };

    const handleDoubleClick = (path: string) => {
        setSelectedPath(path);
        setTimeout(() => handleMove(), 50);
    };

    const handleRootClick = () => {
        setSelectedPath('/');
    };

    const handleRootDoubleClick = () => {
        setSelectedPath('/');
        setTimeout(() => handleMove(), 50);
    };

    const fileLabel = files.length === 1 ? files[0] : `${files.length} items`;

    return (
        <Modal {...props} dismissable={!isSubmitting} showSpinnerOverlay={isSubmitting}>
            <ModalTitle>Move {fileLabel}</ModalTitle>
            <ModalSubtitle>Select a destination folder</ModalSubtitle>
            
            <SelectedPath>
                <PathLabel>Moving to:</PathLabel>
                <PathValue>/home/container{selectedPath === '/' ? '' : selectedPath}</PathValue>
            </SelectedPath>

            <TreeContainer>
                <TreeItem 
                    $depth={0} 
                    $isSelected={selectedPath === '/'} 
                    onClick={handleRootClick}
                    onDoubleClick={handleRootDoubleClick}
                >
                    <ChevronIcon $visible={false}>
                        <FontAwesomeIcon icon={faChevronRight} />
                    </ChevronIcon>
                    <FolderIcon>
                        <FontAwesomeIcon icon={faHome} />
                    </FolderIcon>
                    <FolderName>/ (root)</FolderName>
                </TreeItem>
                
                {initialLoading ? (
                    <LoadingIndicator $depth={1}>
                        <Spinner size="small" />
                        <span>Loading folders...</span>
                    </LoadingIndicator>
                ) : (
                    rootNodes.map((node) => (
                        <TreeNodeComponent
                            key={node.path}
                            node={node}
                            depth={1}
                            selectedPath={selectedPath}
                            onSelect={setSelectedPath}
                            onToggle={handleToggle}
                            onDoubleClick={handleDoubleClick}
                            loadingPaths={loadingPaths}
                        />
                    ))
                )}
            </TreeContainer>

            <HelpText>Double-click a folder to move, or select and click Move</HelpText>

            <ButtonRow>
                <Button.Text onClick={props.onDismissed} disabled={isSubmitting}>
                    Cancel
                </Button.Text>
                <Button onClick={handleMove} disabled={isSubmitting}>
                    Move
                </Button>
            </ButtonRow>
        </Modal>
    );
};

export default MoveFileModal;
