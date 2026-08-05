import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faHome, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { ServerFolder, getFolders, addServerToFolder, removeServerFromFolder } from '@/api/folders';
import { Dialog } from '@/components/elements/dialog';

interface Props {
    serverId: number;
    serverName: string;
    currentFolderId: number | null;
    isOpen: boolean;
    onClose: () => void;
    onMoved: () => void;
}

const FolderList = styled.div`
    ${tw`space-y-1 max-h-64 overflow-y-auto`};
`;

const FolderItem = styled.button<{ $isSelected?: boolean; $color?: string; $depth?: number }>`
    ${tw`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-left`};
    padding-left: ${props => (props.$depth || 0) * 1.5 + 0.75}rem;
    background-color: ${props => props.$isSelected 
        ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' 
        : 'transparent'};
    border: 1px solid ${props => props.$isSelected 
        ? 'var(--color-primary)' 
        : 'transparent'};
    color: var(--color-base);

    &:hover:not(:disabled) {
        background-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
        border-color: var(--color-primary);
    }
`;

const FolderIcon = styled.div<{ $color: string }>`
    ${tw`w-6 h-6 rounded flex items-center justify-center flex-shrink-0`};
    background-color: ${props => props.$color}20;
    color: ${props => props.$color};
    font-size: 0.75rem;
`;

const HomeIcon = styled.div`
    ${tw`w-6 h-6 rounded flex items-center justify-center flex-shrink-0`};
    background-color: var(--color-neutral);
    color: var(--color-muted);
    font-size: 0.75rem;
`;

const FolderName = styled.span`
    ${tw`flex-1 truncate`};
`;

const CurrentBadge = styled.span`
    ${tw`text-xs px-2 py-0.5 rounded`};
    background-color: var(--color-neutral);
    color: var(--color-muted);
`;

export default ({ serverId, serverName, currentFolderId, isOpen, onClose, onMoved }: Props) => {
    const [folders, setFolders] = useState<ServerFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            getFolders().then(data => {
                setFolders(data.data);
            });
            setSelectedFolderId(null);
        }
    }, [isOpen]);

    const handleMove = async () => {
        try {
            if (selectedFolderId === null) {
                if (currentFolderId) {
                    await removeServerFromFolder(currentFolderId, serverId);
                }
            } else {
                await addServerToFolder(selectedFolderId, serverId);
            }
            onMoved();
            onClose();
        } catch (error) {
            console.error('Failed to move server:', error);
        }
    };

    const renderFolder = (folder: ServerFolder, depth: number = 0): React.ReactNode => {
        const isCurrent = currentFolderId === folder.id;
        const isSelected = selectedFolderId === folder.id;

        return (
            <React.Fragment key={folder.id}>
                <FolderItem
                    $isSelected={isSelected}
                    $color={folder.color}
                    $depth={depth}
                    onClick={() => !isCurrent && setSelectedFolderId(folder.id)}
                    disabled={isCurrent}
                    style={isCurrent ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                    <FolderIcon $color={folder.color}>
                        <FontAwesomeIcon icon={faFolder} />
                    </FolderIcon>
                    <FolderName>{folder.name}</FolderName>
                    {isCurrent && <CurrentBadge>Current</CurrentBadge>}
                    {folder.children.length > 0 && (
                        <FontAwesomeIcon 
                            icon={faChevronRight} 
                            style={{ color: 'var(--color-muted)', fontSize: '0.75rem' }} 
                        />
                    )}
                </FolderItem>
                {folder.children.map(child => renderFolder(child, depth + 1))}
            </React.Fragment>
        );
    };

    const isMainViewCurrent = currentFolderId === null;

    return (
        <Dialog.Confirm
            open={isOpen}
            title={`Move "${serverName}"`}
            confirm="Move"
            onClose={onClose}
            onConfirmed={handleMove}
        >
            <p style={{ color: 'var(--color-muted)', marginBottom: '1rem' }}>
                Select a destination folder:
            </p>
            <FolderList>
                <FolderItem
                    $isSelected={selectedFolderId === null && currentFolderId !== null}
                    onClick={() => currentFolderId !== null && setSelectedFolderId(null)}
                    disabled={isMainViewCurrent}
                    style={isMainViewCurrent ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                    <HomeIcon>
                        <FontAwesomeIcon icon={faHome} />
                    </HomeIcon>
                    <FolderName>Main View (No Folder)</FolderName>
                    {isMainViewCurrent && <CurrentBadge>Current</CurrentBadge>}
                </FolderItem>
                {folders.map(folder => renderFolder(folder))}
            </FolderList>
        </Dialog.Confirm>
    );
};
