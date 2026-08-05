import React, { useState, useEffect } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTrash, 
    faUndo, 
    faTrashAlt, 
    faFileAlt,
    faFileArchive,
    faFolder, 
    faTimes,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import { restoreFromTrash, emptyTrash, getTrashPath, purgeExpiredTrash } from '@/api/server/files/trashFiles';
import Spinner from '@/components/elements/Spinner';
import { useFlashKey } from '@/plugins/useFlash';
import { Dialog } from '@/components/elements/dialog';
import { bytesToString } from '@/lib/formatters';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import { useStoreState } from '@/state/hooks';
import styles from './style.module.css';

interface TrashCanModalProps {
    visible: boolean;
    onDismissed: () => void;
    onRestored?: () => void;
}

const Overlay = styled.div`
    ${tw`fixed inset-0 z-50 flex items-center justify-center`};
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
`;

const ModalContainer = styled.div`
    ${tw`relative w-full max-w-4xl mx-4`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
`;

const ModalHeader = styled.div`
    ${tw`flex items-center justify-between px-6 py-4`};
    border-bottom: 1px solid var(--color-neutral);
`;

const ModalTitle = styled.h2`
    ${tw`flex items-center text-lg font-semibold`};
    color: var(--color-base);

    svg {
        ${tw`mr-3`};
        color: var(--color-muted);
    }
`;

const CloseButton = styled.button`
    ${tw`p-2 rounded-lg transition-all duration-150`};
    color: var(--color-muted);
    background: transparent;

    &:hover {
        background: var(--color-background-secondary);
        color: var(--color-base);
    }
`;

const ModalBody = styled.div`
    ${tw`flex-1 overflow-y-auto`};
`;

const ModalFooter = styled.div`
    ${tw`flex items-center justify-between px-6 py-4`};
    border-top: 1px solid var(--color-neutral);
    background-color: var(--color-background-secondary);
    border-radius: 0 0 var(--border-radius, 12px) var(--border-radius, 12px);
`;

const EmptyState = styled.div`
    ${tw`flex flex-col items-center justify-center py-12`};
    color: var(--color-muted);

    svg {
        ${tw`text-4xl mb-4`};
        opacity: 0.5;
    }
`;

const TrashStats = styled.div`
    ${tw`text-sm`};
    color: var(--color-muted);
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
    ${tw`px-3 py-2 rounded-lg transition-all duration-150 text-sm`};
    color: ${props => props.$danger ? '#ef4444' : 'var(--color-muted)'};
    background: transparent;

    &:hover:not(:disabled) {
        background: ${props => props.$danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-background)'};
        color: ${props => props.$danger ? '#ef4444' : 'var(--color-base)'};
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const TrashCanModal: React.FC<TrashCanModalProps> = ({ visible, onDismissed, onRestored }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearAndAddHttpError } = useFlashKey('files');
    const trashAutoDeleteHours = useStoreState((state) => {
        const configuredHours = state.settings.data?.components?.trashAutoDeleteHours ?? 168;
        const parsedHours = Number(configuredHours);
        if (!Number.isFinite(parsedHours) || parsedHours < 1) {
            return 168;
        }

        return Math.floor(parsedHours);
    });
    
    const [trashItems, setTrashItems] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const loadTrashContents = async () => {
        setLoading(true);
        try {
            const files = await loadDirectory(uuid, getTrashPath());
            const expiredFiles = await purgeExpiredTrash(uuid, files.map((item) => item.name), trashAutoDeleteHours);
            if (expiredFiles.length > 0) {
                const expiredSet = new Set(expiredFiles);
                setTrashItems(files.filter((item) => !expiredSet.has(item.name)));
            } else {
                setTrashItems(files);
            }
        } catch (error: any) {
            setTrashItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            loadTrashContents();
        }
    }, [visible, trashAutoDeleteHours, uuid]);

    const handleRestore = async (item: FileObject) => {
        setActionLoading(item.name);
        try {
            await restoreFromTrash(uuid, item.name);
            await loadTrashContents();
            onRestored?.();
        } catch (error: any) {
            clearAndAddHttpError(error);
        } finally {
            setActionLoading(null);
        }
    };

    const handlePermanentDelete = async (item: FileObject) => {
        setActionLoading(item.name);
        setShowDeleteConfirm(null);
        try {
            await emptyTrash(uuid, [item.name]);
            await loadTrashContents();
        } catch (error: any) {
            clearAndAddHttpError(error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleEmptyTrash = async () => {
        setActionLoading('empty');
        setShowEmptyConfirm(false);
        try {
            await emptyTrash(uuid, trashItems.map((item) => item.name));
            setTrashItems([]);
        } catch (error: any) {
            clearAndAddHttpError(error);
        } finally {
            setActionLoading(null);
        }
    };

    const getDisplayName = (name: string) => {
        const separatorIndex = name.indexOf(':');
        if (separatorIndex > 0) {
            const timestamp = name.slice(0, separatorIndex);
            if (/^\d+$/.test(timestamp)) {
                const rest = name.slice(separatorIndex + 1);
                const secondSeparatorIndex = rest.indexOf(':');
                if (secondSeparatorIndex > 0) {
                    return rest.slice(secondSeparatorIndex + 1);
                }
            }
        }

        const legacyMatch = name.match(/^(\d+)__([^_].*?)__(.+)$/);
        if (legacyMatch) {
            return legacyMatch[3];
        }

        return name.replace(/^\d+_/, '');
    };

    const getTotalSize = () => {
        return trashItems.reduce((acc, item) => acc + item.size, 0);
    };

    const getAutoDeleteLabel = () => {
        const days = trashAutoDeleteHours / 24;
        if (Number.isInteger(days) && days >= 1) {
            return `Auto-delete after ${days} day${days === 1 ? '' : 's'}`;
        }

        return `Auto-delete after ${trashAutoDeleteHours} hour${trashAutoDeleteHours === 1 ? '' : 's'}`;
    };

    if (!visible) return null;

    return (
        <>
            <Dialog.Confirm
                open={showEmptyConfirm}
                onClose={() => setShowEmptyConfirm(false)}
                title="Empty Trash"
                confirm="Empty Trash"
                onConfirmed={handleEmptyTrash}
            >
                <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mt-1" />
                    <p>
                        Are you sure you want to permanently delete all {trashItems.length} items in the trash? 
                        This action cannot be undone.
                    </p>
                </div>
            </Dialog.Confirm>
            <Dialog.Confirm
                open={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                title="Permanently Delete"
                confirm="Delete Forever"
                onConfirmed={() => {
                    const item = trashItems.find((i) => i.name === showDeleteConfirm);
                    if (item) handlePermanentDelete(item);
                }}
            >
                <p>
                    Are you sure you want to permanently delete this item? 
                    This action cannot be undone.
                </p>
            </Dialog.Confirm>
            <Overlay onClick={onDismissed}>
                <ModalContainer onClick={(e) => e.stopPropagation()}>
                    <ModalHeader>
                        <ModalTitle>
                            <FontAwesomeIcon icon={faTrash} />
                            Trash Can
                        </ModalTitle>
                        <CloseButton onClick={onDismissed}>
                            <FontAwesomeIcon icon={faTimes} />
                        </CloseButton>
                    </ModalHeader>
                    <ModalBody>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Spinner size="large" />
                            </div>
                        ) : trashItems.length === 0 ? (
                            <EmptyState>
                                <FontAwesomeIcon icon={faTrash} />
                                <p>Trash is empty</p>
                            </EmptyState>
                        ) : (
                            <div className={styles.file_table} style={{ border: 'none', borderRadius: 0 }}>
                                <div className={styles.file_header} style={{ paddingLeft: '1rem', paddingRight: '0.5rem' }}>
                                    <div className="w-6 mr-3 flex-none" />
                                    <div className="flex-1">Name</div>
                                    <div className="w-24 text-right hidden sm:block">Size</div>
                                    <div className="w-48 text-right hidden md:block">Deleted</div>
                                    <div className="w-40 flex-none" />
                                </div>
                                {trashItems.map((item) => (
                                    <div 
                                        key={item.key} 
                                        className={styles.trash_row}
                                    >
                                        <div className="flex flex-1 items-center py-3 px-4 overflow-hidden">
                                            <div 
                                                className="flex-none w-6 mr-3 text-center"
                                                style={{ color: item.isFile ? 'var(--color-muted)' : 'var(--color-primary)' }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={item.isFile ? (item.isArchiveType() ? faFileArchive : faFileAlt) : faFolder}
                                                />
                                            </div>
                                            <div className="flex-1 truncate" style={{ color: 'var(--color-base)' }}>
                                                {getDisplayName(item.name)}
                                            </div>
                                            <div 
                                                className="w-24 text-right hidden sm:block text-xs"
                                                style={{ color: 'var(--color-muted)' }}
                                            >
                                                {item.isFile ? bytesToString(item.size) : '—'}
                                            </div>
                                            <div 
                                                className="w-48 text-right hidden md:block text-xs"
                                                style={{ color: 'var(--color-muted)' }}
                                                title={item.modifiedAt.toString()}
                                            >
                                                {Math.abs(differenceInHours(item.modifiedAt, new Date())) > 48
                                                    ? format(item.modifiedAt, 'MMM do, yyyy h:mma')
                                                    : formatDistanceToNow(item.modifiedAt, { addSuffix: true })}
                                            </div>
                                        </div>
                                        <div className="flex items-center pr-2 w-40 flex-none justify-end">
                                            <ActionButton 
                                                onClick={() => handleRestore(item)} 
                                                title="Restore"
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === item.name ? (
                                                    <Spinner size="small" />
                                                ) : (
                                                    <>
                                                        <FontAwesomeIcon icon={faUndo} className="mr-1" />
                                                    </>
                                                )}
                                            </ActionButton>
                                            <ActionButton 
                                                $danger 
                                                onClick={() => setShowDeleteConfirm(item.name)} 
                                                title="Delete Forever"
                                                disabled={!!actionLoading}
                                            >
                                                <FontAwesomeIcon icon={faTrashAlt} className="mr-1" />
                                            </ActionButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <TrashStats>
                            {trashItems.length} {trashItems.length === 1 ? 'item' : 'items'} • {bytesToString(getTotalSize())}
                            <span className="block mt-1">{getAutoDeleteLabel()}</span>
                        </TrashStats>
                        {trashItems.length > 0 && (
                            <Button.Danger 
                                onClick={() => setShowEmptyConfirm(true)}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'empty' ? (
                                    <Spinner size="small" />
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faTrashAlt} className="mr-2" />
                                        Empty Trash
                                    </>
                                )}
                            </Button.Danger>
                        )}
                    </ModalFooter>
                </ModalContainer>
            </Overlay>
        </>
    );
};

export default TrashCanModal;
