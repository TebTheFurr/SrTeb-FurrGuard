import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faPen, faTrash, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { ServerFolder, updateFolder, deleteFolder } from '@/api/folders';
import { Dialog } from '@/components/elements/dialog';
import Input from '@/components/elements/Input';
import { useDroppable } from '@dnd-kit/core';

interface Props {
    folder: ServerFolder;
    serverCount?: number;
    onClick: () => void;
    onUpdate: () => void;
    isDragging?: boolean;
    isServerDropActive?: boolean;
    droppableId?: string;
}

const FolderContainer = styled.div<{
    $color: string;
    $isDragging?: boolean;
    $isServerDropActive?: boolean;
    $isServerDropOver?: boolean;
}>`
    ${tw`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all duration-150`};
    background-color: var(--color-background-secondary);
    border: 2px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    opacity: ${(props) => (props.$isDragging ? 0.92 : 1)};
    transform: ${(props) => (props.$isDragging ? 'scale(1.015)' : 'scale(1)')};
    box-shadow: ${(props) => (props.$isDragging ? '0 18px 45px rgba(0, 0, 0, 0.24)' : 'none')};

    &:hover {
        border-color: ${(props) => props.$color};
    }

    ${(props) =>
        props.$isServerDropActive
            ? `
        border-color: ${props.$color};
        box-shadow: 0 0 0 3px ${props.$color}20;
    `
            : ''}

    ${(props) =>
        props.$isServerDropOver
            ? `
        border-color: ${props.$color};
        box-shadow: 0 0 0 4px ${props.$color}28, 0 18px 45px rgba(0, 0, 0, 0.18);
        transform: scale(1.01);
    `
            : ''}
`;

const FolderIcon = styled.div<{ $color: string }>`
    ${tw`w-10 h-10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0`};
    background-color: ${(props) => props.$color}20;
    color: ${(props) => props.$color};
`;

const FolderInfo = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const FolderName = styled.p`
    ${tw`font-medium truncate`};
    color: var(--color-base);
    white-space: normal;
`;

const FolderMeta = styled.p`
    ${tw`text-sm`};
    color: var(--color-muted);
`;

const ActionButtons = styled.div`
    ${tw`flex items-center gap-2 ml-4`};
`;

const IconButton = styled.button`
    ${tw`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150`};
    background-color: transparent;
    color: var(--color-muted);
    border: 1px solid transparent;

    &:hover {
        background-color: var(--color-background);
        border-color: var(--color-neutral);
        color: var(--color-base);
    }
`;

const ColorPicker = styled.input`
    ${tw`w-10 h-10 rounded-lg cursor-pointer`};
    border: 2px solid var(--color-neutral);
    padding: 2px;
    background-color: var(--color-background-secondary);

    &::-webkit-color-swatch-wrapper {
        padding: 0;
    }

    &::-webkit-color-swatch {
        border: none;
        border-radius: 6px;
    }
`;

export default ({ folder, serverCount, onClick, onUpdate, isDragging, isServerDropActive, droppableId }: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const [editSlug, setEditSlug] = useState(folder.slug || '');
    const [editColor, setEditColor] = useState(folder.color);

    const normaliseSlug = (value: string): string =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

    const handleEdit = async () => {
        if (!editName.trim()) return;

        try {
            await updateFolder(folder.id, {
                name: editName,
                slug: normaliseSlug(editSlug) || null,
                color: editColor,
            });
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            console.error('Failed to update folder:', error);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteFolder(folder.id);
            setIsDeleting(false);
            onUpdate();
        } catch (error) {
            console.error('Failed to delete folder:', error);
        }
    };

    const displayServerCount =
        serverCount ?? folder.server_count + folder.children.reduce((acc, child) => acc + child.server_count, 0);
    const childCount = folder.children.length;
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId || `folder-drop:${folder.id}`,
        disabled: !isServerDropActive,
    });

    return (
        <>
            <FolderContainer
                ref={setNodeRef}
                $color={folder.color}
                $isDragging={isDragging}
                $isServerDropActive={isServerDropActive}
                $isServerDropOver={isOver}
                onClick={onClick}
            >
                <div className='flex items-center flex-1 min-w-0'>
                    <FolderIcon $color={folder.color}>
                        <FontAwesomeIcon icon={faFolder} className='text-lg' />
                    </FolderIcon>
                    <FolderInfo>
                        <FolderName>{folder.name}</FolderName>
                        <FolderMeta>
                            {displayServerCount} {displayServerCount === 1 ? 'server' : 'servers'}
                            {childCount > 0 && ` · ${childCount} ${childCount === 1 ? 'subfolder' : 'subfolders'}`}
                        </FolderMeta>
                    </FolderInfo>
                </div>
                <ActionButtons>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditName(folder.name);
                            setEditSlug(folder.slug || '');
                            setEditColor(folder.color);
                            setIsEditing(true);
                        }}
                        title='Edit folder'
                    >
                        <FontAwesomeIcon icon={faPen} />
                    </IconButton>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleting(true);
                        }}
                        title='Delete folder'
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </IconButton>
                    <FontAwesomeIcon icon={faChevronRight} className='ml-2' style={{ color: 'var(--color-muted)' }} />
                </ActionButtons>
            </FolderContainer>

            <Dialog.Confirm
                open={isEditing}
                title='Edit Folder'
                confirm='Save Changes'
                onClose={() => setIsEditing(false)}
                onConfirmed={handleEdit}
            >
                <div className='space-y-4'>
                    <div>
                        <label className='text-sm mb-2 block' style={{ color: 'var(--color-muted)' }}>
                            Folder Name
                        </label>
                        <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder='Enter folder name'
                        />
                    </div>
                    <div>
                        <label className='text-sm mb-2 block' style={{ color: 'var(--color-muted)' }}>
                            Slug
                        </label>
                        <Input
                            value={editSlug}
                            onChange={(e) => setEditSlug(normaliseSlug(e.target.value))}
                            placeholder='folder-slug'
                        />
                    </div>
                    <div>
                        <label className='text-sm mb-2 block' style={{ color: 'var(--color-muted)' }}>
                            Color
                        </label>
                        <div className='flex items-center gap-3'>
                            <ColorPicker
                                type='color'
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                            />
                            <Input
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                placeholder='#000000'
                                className='flex-1'
                            />
                        </div>
                    </div>
                </div>
            </Dialog.Confirm>

            <Dialog.Confirm
                open={isDeleting}
                title='Delete Folder'
                confirm='Delete'
                onClose={() => setIsDeleting(false)}
                onConfirmed={handleDelete}
            >
                <p style={{ color: 'var(--color-muted)' }}>
                    Are you sure you want to delete &quot;{folder.name}&quot;?
                    {displayServerCount > 0 &&
                        ` The ${displayServerCount} server(s) inside will be moved back to the main view.`}
                    {childCount > 0 && ` All ${childCount} subfolder(s) will also be deleted.`}
                </p>
            </Dialog.Confirm>
        </>
    );
};
