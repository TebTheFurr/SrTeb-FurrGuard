import React, { memo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxOpen,
    faCopy,
    faEllipsisH,
    faFileArchive,
    faDownload,
    faShare,
    faPen,
    faTrash,
    faKey,
    faCompress,
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import RenameFileModal from '@/components/server/files/RenameFileModal';
import MoveFileModal from '@/components/server/files/MoveFileModal';
import CompressImageModal from '@/components/server/files/CompressImageModal';
import { ServerContext } from '@/state/server';
import { join } from 'pathe';
import deleteFiles from '@/api/server/files/deleteFiles';
import { moveToTrash, getTrashPath } from '@/api/server/files/trashFiles';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import copyFile from '@/api/server/files/copyFile';
import Can from '@/components/elements/Can';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { FileObject } from '@/api/server/files/loadDirectory';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import DropdownMenu from '@/components/elements/DropdownMenu';
import styled from 'styled-components/macro';
import useEventListener from '@/plugins/useEventListener';
import compressFiles from '@/api/server/files/compressFiles';
import decompressFiles from '@/api/server/files/decompressFiles';
import isEqual from 'react-fast-compare';
import ChmodFileModal from '@/components/server/files/ChmodFileModal';
import DeleteConfirmDialog from '@/components/server/files/DeleteConfirmDialog';
import { useStoreState } from 'easy-peasy';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

const isImageFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return IMAGE_EXTENSIONS.includes(ext);
};

type ModalType = 'rename' | 'move' | 'chmod' | 'compress-image';

const MenuSection = styled.div`
    &:not(:last-child) {
        border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 50%, transparent);
        padding-bottom: 6px;
        margin-bottom: 6px;
    }
`;

const MenuItem = styled.button<{ $variant?: 'default' | 'danger' }>`
    ${tw`w-full flex items-center gap-3 text-left transition-all duration-100`};
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 450;
    color: ${props => props.$variant === 'danger' ? '#f87171' : 'var(--color-muted)'};
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
        background-color: ${props => props.$variant === 'danger' 
            ? 'rgba(239, 68, 68, 0.12)' 
            : 'color-mix(in srgb, var(--color-primary) 12%, transparent)'};
        color: ${props => props.$variant === 'danger' ? '#fca5a5' : 'var(--color-base)'};
    }

    &:active {
        transform: scale(0.98);
    }
`;

const MenuIcon = styled.span<{ $variant?: 'default' | 'danger' }>`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 18px;
    height: 18px;
    font-size: 0.75rem;
    opacity: 0.7;
    color: ${props => props.$variant === 'danger' ? '#f87171' : 'var(--color-primary)'};
`;

const MenuLabel = styled.span`
    ${tw`flex-1`};
`;

const TriggerButton = styled.div<{ $disabled?: boolean }>`
    ${tw`flex items-center justify-center cursor-pointer transition-all duration-150`};
    padding: 6px;
    border-radius: 6px;
    margin-right: 8px;
    color: ${({ $disabled }) => $disabled ? 'color-mix(in srgb, var(--color-muted) 60%, transparent)' : 'var(--color-muted)'};
    cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};

    &:hover {
        color: ${({ $disabled }) => $disabled ? 'color-mix(in srgb, var(--color-muted) 60%, transparent)' : 'var(--color-base)'};
        background-color: ${({ $disabled }) => $disabled ? 'transparent' : 'color-mix(in srgb, var(--color-neutral) 50%, transparent)'};
    }
`;

interface MenuItemProps {
    icon: IconDefinition;
    label: string;
    variant?: 'default' | 'danger';
    onClick: () => void;
}

const MenuItemRow = ({ icon, label, variant = 'default', onClick }: MenuItemProps) => (
    <MenuItem $variant={variant} onClick={onClick}>
        <MenuIcon $variant={variant}>
            <FontAwesomeIcon icon={icon} />
        </MenuIcon>
        <MenuLabel>{label}</MenuLabel>
    </MenuItem>
);

const FileDropdownMenu = ({ file, directory: directoryOverride }: { file: FileObject; directory?: string }) => {
    const onClickRef = useRef<DropdownMenu>(null);
    const [showSpinner, setShowSpinner] = useState(false);
    const [modal, setModal] = useState<ModalType | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearAndAddHttpError, clearFlashes } = useFlash();
    const contextDirectory = ServerContext.useStoreState((state) => state.files.directory);
    const directory = directoryOverride ?? contextDirectory;
    const trashEnabled = useStoreState((state) => state.settings.data?.components?.trashEnabled ?? true);
    const trashAutoDeleteHours = useStoreState((state) => state.settings.data?.components?.trashAutoDeleteHours ?? 168);

    const isInTrash = directory.startsWith(getTrashPath());

    useEventListener(`pterodactyl:files:ctx:${file.key}`, (e: CustomEvent<{ x: number; y: number }>) => {
        if (onClickRef.current) {
            onClickRef.current.triggerMenu(e.detail.x, e.detail.y);
        }
    });

    if (file.isRestricted) {
        return (
            <TriggerButton $disabled title="This file is restricted">
                <FontAwesomeIcon icon={faEllipsisH} />
            </TriggerButton>
        );
    }

    const doPermanentDeletion = () => {
        clearFlashes('files');
        setShowDeleteDialog(false);
        mutate((files) => files.filter((f) => f.key !== file.key), false);

        deleteFiles(uuid, directory, [file.name]).catch((error) => {
            mutate();
            clearAndAddHttpError({ key: 'files', error });
        });
    };

    const doMoveToTrash = () => {
        clearFlashes('files');
        setShowDeleteDialog(false);
        setShowSpinner(true);
        mutate((files) => files.filter((f) => f.key !== file.key), false);

        moveToTrash(uuid, directory, [file.name], Number(trashAutoDeleteHours))
            .then(() => mutate())
            .catch((error) => {
                mutate();
                clearAndAddHttpError({ key: 'files', error });
            })
            .finally(() => setShowSpinner(false));
    };

    const doCopy = () => {
        setShowSpinner(true);
        clearFlashes('files');

        copyFile(uuid, join(directory, file.name))
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doDownload = () => {
        setShowSpinner(true);
        clearFlashes('files');

        getFileDownloadUrl(uuid, join(directory, file.name))
            .then((url) => {
                // @ts-expect-error this is valid
                window.location = url;
            })
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doArchive = () => {
        setShowSpinner(true);
        clearFlashes('files');

        compressFiles(uuid, directory, [file.name])
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doUnarchive = () => {
        setShowSpinner(true);
        clearFlashes('files');

        decompressFiles(uuid, directory, file.name)
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    return (
        <>
            <DeleteConfirmDialog
                visible={showDeleteDialog}
                itemName={file.name}
                isFile={file.isFile}
                trashEnabled={trashEnabled}
                onMoveToTrash={doMoveToTrash}
                onPermanentDelete={doPermanentDeletion}
                onCancel={() => setShowDeleteDialog(false)}
            />
            <DropdownMenu
                ref={onClickRef}
                renderToggle={(onClick) => (
                    <TriggerButton onClick={onClick}>
                        <FontAwesomeIcon icon={faEllipsisH} />
                        {modal ? (
                            modal === 'chmod' ? (
                                <ChmodFileModal
                                    visible
                                    appear
                                    files={[{ file: file.name, mode: file.modeBits }]}
                                    onDismissed={() => setModal(null)}
                                />
                            ) : modal === 'move' ? (
                                <MoveFileModal
                                    visible
                                    appear
                                    files={[file.name]}
                                    onDismissed={() => setModal(null)}
                                />
                            ) : modal === 'compress-image' ? (
                                <CompressImageModal
                                    visible
                                    appear
                                    file={file}
                                    onDismissed={() => setModal(null)}
                                />
                            ) : (
                                <RenameFileModal
                                    visible
                                    appear
                                    files={[file.name]}
                                    onDismissed={() => setModal(null)}
                                />
                            )
                        ) : null}
                        <SpinnerOverlay visible={showSpinner} fixed size={'large'} />
                    </TriggerButton>
                )}
            >
                <Can action={'file.update'}>
                    <MenuSection>
                        <MenuItemRow 
                            icon={faPen} 
                            label="Rename" 
                            onClick={() => setModal('rename')} 
                        />
                        <MenuItemRow 
                            icon={faShare} 
                            label="Move" 
                            onClick={() => setModal('move')} 
                        />
                        <MenuItemRow 
                            icon={faKey} 
                            label="Permissions" 
                            onClick={() => setModal('chmod')} 
                        />
                    </MenuSection>
                </Can>

                <MenuSection>
                    {file.isFile && (
                        <Can action={'file.create'}>
                            <MenuItemRow 
                                icon={faCopy} 
                                label="Duplicate" 
                                onClick={doCopy} 
                            />
                        </Can>
                    )}
                    {file.isFile && isImageFile(file.name) && (
                        <Can action={'file.update'}>
                            <MenuItemRow 
                                icon={faCompress} 
                                label="Compress Image" 
                                onClick={() => setModal('compress-image')} 
                            />
                        </Can>
                    )}
                    {file.isArchiveType() ? (
                        <Can action={'file.create'}>
                            <MenuItemRow 
                                icon={faBoxOpen} 
                                label="Extract" 
                                onClick={doUnarchive} 
                            />
                        </Can>
                    ) : (
                        <Can action={'file.archive'}>
                            <MenuItemRow 
                                icon={faFileArchive} 
                                label="Archive" 
                                onClick={doArchive} 
                            />
                        </Can>
                    )}
                    {file.isFile && (
                        <MenuItemRow 
                            icon={faDownload} 
                            label="Download" 
                            onClick={doDownload} 
                        />
                    )}
                </MenuSection>

                <Can action={'file.delete'}>
                    <MenuSection>
                        <MenuItemRow 
                            icon={faTrash} 
                            label={isInTrash ? 'Delete Permanently' : 'Delete'} 
                            variant="danger"
                            onClick={() => isInTrash ? doPermanentDeletion() : setShowDeleteDialog(true)} 
                        />
                    </MenuSection>
                </Can>
            </DropdownMenu>
        </>
    );
};

export default memo(FileDropdownMenu, isEqual);
