import React, { useContext, useEffect, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { Button } from '@/components/elements/button/index';
import Fade from '@/components/elements/Fade';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';
import compressFiles from '@/api/server/files/compressFiles';
import { ServerContext } from '@/state/server';
import deleteFiles from '@/api/server/files/deleteFiles';
import { moveToTrash, getTrashPath } from '@/api/server/files/trashFiles';
import MoveFileModal from '@/components/server/files/MoveFileModal';
import Portal from '@/components/elements/Portal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { Dialog, DialogContext } from '@/components/elements/dialog';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import { useStoreState } from 'easy-peasy';

const CustomFooter = ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div
                className={'px-6 py-4 flex items-center justify-between'}
                style={{
                    backgroundColor: 'var(--color-neutral)',
                    borderBottomLeftRadius: 'var(--border-radius, 12px)',
                    borderBottomRightRadius: 'var(--border-radius, 12px)'
                }}
            >
                {children}
            </div>
        );
    }, [children]);

    return null;
};

const Message = styled.p`
    ${tw`text-sm mt-4`};
    color: var(--color-muted);

    strong {
        color: var(--color-base);
        font-weight: 600;
    }
`;

const FileList = styled.ul`
    ${tw`mt-3 text-xs max-h-32 overflow-y-auto`};
    color: var(--color-muted);

    li {
        ${tw`py-1`};
    }
`;

const ActionButtons = styled.div`
    ${tw`flex items-center gap-2`};
`;

const MassActionsBar = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);
    const [showMove, setShowMove] = useState(false);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const trashEnabled = useStoreState((state) => state.settings.data?.components?.trashEnabled ?? true);
    const trashAutoDeleteHours = useStoreState((state) => state.settings.data?.components?.trashAutoDeleteHours ?? 168);

    const selectedFiles = ServerContext.useStoreState((state) => state.files.selectedFiles);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);

    const isInTrash = directory.startsWith(getTrashPath());

    useEffect(() => {
        if (!loading) setLoadingMessage('');
    }, [loading]);

    const onClickCompress = () => {
        setLoading(true);
        clearFlashes('files');
        setLoadingMessage('Archiving files...');

        compressFiles(uuid, directory, selectedFiles)
            .then(() => mutate())
            .then(() => setSelectedFiles([]))
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setLoading(false));
    };

    const onClickMoveToTrash = () => {
        setLoading(true);
        setShowDeleteOptions(false);
        clearFlashes('files');
        setLoadingMessage('Moving to trash...');

        moveToTrash(uuid, directory, selectedFiles, Number(trashAutoDeleteHours))
            .then(() => {
                mutate((files) => files.filter((f) => selectedFiles.indexOf(f.name) < 0), false);
                setSelectedFiles([]);
            })
            .catch((error) => {
                mutate();
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => setLoading(false));
    };

    const onClickPermanentDelete = () => {
        setLoading(true);
        setShowDeleteOptions(false);
        clearFlashes('files');
        setLoadingMessage('Deleting files permanently...');

        deleteFiles(uuid, directory, selectedFiles)
            .then(() => {
                mutate((files) => files.filter((f) => selectedFiles.indexOf(f.name) < 0), false);
                setSelectedFiles([]);
            })
            .catch((error) => {
                mutate();
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => setLoading(false));
    };

    return (
        <>
            <div css={tw`pointer-events-none fixed bottom-0 z-20 left-0 right-0 flex justify-center`}>
                <SpinnerOverlay visible={loading} size={'large'} fixed>
                    {loadingMessage}
                </SpinnerOverlay>
                <Dialog
                    open={showDeleteOptions}
                    onClose={() => setShowDeleteOptions(false)}
                    title={`Delete ${selectedFiles.length} ${selectedFiles.length === 1 ? 'File' : 'Files'}`}
                >
                    <Message>
                        Are you sure you want to delete <strong>{selectedFiles.length} {selectedFiles.length === 1 ? 'item' : 'items'}</strong>?
                    </Message>
                    <FileList>
                        {selectedFiles.slice(0, 10).map((file) => (
                            <li key={file}>{file}</li>
                        ))}
                        {selectedFiles.length > 10 && <li>and {selectedFiles.length - 10} more...</li>}
                    </FileList>
                    <CustomFooter>
                        <Button.Text onClick={() => setShowDeleteOptions(false)}>Cancel</Button.Text>
                        <ActionButtons>
                            {isInTrash || !trashEnabled ? (
                                <Button.Danger onClick={onClickPermanentDelete}>
                                    <FontAwesomeIcon icon={faTrashAlt} className="mr-2" />
                                    Delete Forever
                                </Button.Danger>
                            ) : (
                                <>
                                    <Button onClick={onClickMoveToTrash}>
                                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                        Trash
                                    </Button>
                                    <Button.Danger onClick={onClickPermanentDelete}>
                                        <FontAwesomeIcon icon={faTrashAlt} className="mr-2" />
                                        Delete Permanently
                                    </Button.Danger>
                                </>
                            )}
                        </ActionButtons>
                    </CustomFooter>
                </Dialog>
                {showMove && (
                    <MoveFileModal
                        files={selectedFiles}
                        visible
                        appear
                        onDismissed={() => setShowMove(false)}
                    />
                )}
                <Portal>
                    <div className="pointer-events-none fixed bottom-[5px] mb-6 flex justify-center w-full z-50 px-2 md:pl-[260px] md:pr-0">
                        <Fade timeout={75} in={selectedFiles.length > 0} unmountOnExit>
                            <div
                                className="flex flex-wrap items-center gap-2 pointer-events-auto p-3 max-w-full"
                                style={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    border: '1px solid var(--color-neutral)',
                                    borderRadius: 'var(--border-radius, 12px)',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <span className="text-sm px-2 whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>
                                    {selectedFiles.length} selected
                                </span>
                                {!isInTrash && <Button onClick={() => setShowMove(true)}>Move</Button>}
                                {!isInTrash && <Button onClick={onClickCompress}>Archive</Button>}
                                <Button.Danger onClick={() => setShowDeleteOptions(true)}>
                                    {isInTrash ? 'Delete Forever' : 'Delete'}
                                </Button.Danger>
                            </div>
                        </Fade>
                    </div>
                </Portal>
            </div>
        </>
    );
};

export default MassActionsBar;
