import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTimesCircle, faFileAlt, faFileCode, faFileArchive } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

export interface OpenTab {
    path: string;
    name: string;
    isModified?: boolean;
}

interface FileTabsProps {
    tabs: OpenTab[];
    activeTab: string | null;
    onTabSelect: (path: string) => void;
    onTabClose: (path: string) => void;
    onCloseAll: () => void;
}

const TabsContainer = styled.div`
    ${tw`flex items-center flex-wrap gap-1 p-2`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
    min-height: 2.75rem;
`;

const Tab = styled.button<{ $isActive: boolean }>`
    ${tw`flex items-center gap-2 px-3 py-1.5 text-sm transition-all duration-100`};
    background-color: ${({ $isActive }) => $isActive ? 'var(--color-background-secondary)' : 'transparent'};
    border: 1px solid ${({ $isActive }) => $isActive ? 'var(--color-neutral)' : 'transparent'};
    border-radius: 0.375rem;
    color: ${({ $isActive }) => $isActive ? 'var(--color-base)' : 'var(--color-muted)'};
    max-width: 200px;

    &:hover {
        background-color: var(--color-background-secondary);
        color: var(--color-base);
    }
`;

const TabIcon = styled.span`
    ${tw`flex-shrink-0`};
    font-size: 0.75rem;
    color: var(--color-muted);
`;

const TabName = styled.span<{ $isModified?: boolean }>`
    ${tw`truncate`};
    
    &::after {
        content: '${props => props.$isModified ? ' •' : ''}';
        color: var(--color-primary);
    }
`;

const CloseButton = styled.span`
    ${tw`flex-shrink-0 flex items-center justify-center rounded transition-colors duration-100`};
    width: 1rem;
    height: 1rem;
    font-size: 0.625rem;
    color: var(--color-muted);

    &:hover {
        background-color: var(--color-neutral);
        color: var(--color-base);
    }
`;

const CloseAllButton = styled.button`
    ${tw`flex items-center gap-1.5 px-2 py-1 text-xs transition-colors duration-100 ml-auto`};
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: var(--color-muted);

    &:hover {
        background-color: var(--color-background-secondary);
        border-color: var(--color-neutral);
        color: var(--color-base);
    }
`;

const EmptyState = styled.div`
    ${tw`flex items-center px-3 text-sm`};
    color: var(--color-muted);
`;

const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'scss', 'html', 'xml', 'json', 'yml', 'yaml', 'sh', 'bash', 'php', 'rb', 'go', 'rs', 'swift', 'kt'];
    const archiveExtensions = ['zip', 'tar', 'gz', 'rar', '7z', 'jar'];
    
    if (ext && archiveExtensions.includes(ext)) {
        return faFileArchive;
    }
    if (ext && codeExtensions.includes(ext)) {
        return faFileCode;
    }
    return faFileAlt;
};

const FileTabs: React.FC<FileTabsProps> = ({ tabs, activeTab, onTabSelect, onTabClose, onCloseAll }) => {
    const handleClose = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        onTabClose(path);
    };

    return (
        <TabsContainer>
            {tabs.length === 0 ? (
                <EmptyState>No files open</EmptyState>
            ) : (
                <>
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.path}
                            $isActive={activeTab === tab.path}
                            onClick={() => onTabSelect(tab.path)}
                        >
                            <TabIcon>
                                <FontAwesomeIcon icon={getFileIcon(tab.name)} />
                            </TabIcon>
                            <TabName $isModified={tab.isModified}>{tab.name}</TabName>
                            <CloseButton onClick={(e) => handleClose(e, tab.path)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </CloseButton>
                        </Tab>
                    ))}
                    {tabs.length > 1 && (
                        <CloseAllButton onClick={onCloseAll}>
                            <FontAwesomeIcon icon={faTimesCircle} />
                        </CloseAllButton>
                    )}
                </>
            )}
        </TabsContainer>
    );
};

export default FileTabs;
