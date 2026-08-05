import axios, { AxiosProgressEvent } from 'axios';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import createDirectory from '@/api/server/files/createDirectory';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import React, { useEffect, useRef, useState } from 'react';
import { ModalMask } from '@/components/elements/Modal';
import Fade from '@/components/elements/Fade';
import useEventListener from '@/plugins/useEventListener';
import { useFlashKey } from '@/plugins/useFlash';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { ServerContext } from '@/state/server';
import { WithClassname } from '@/components/types';
import Portal from '@/components/elements/Portal';
import { CloudUploadIcon, FolderAddIcon } from '@heroicons/react/outline';
import { join } from 'pathe';

function isFileOrDirectory(event: DragEvent): boolean {
    if (!event.dataTransfer?.types) {
        return false;
    }

    return event.dataTransfer.types.some((value) => value.toLowerCase() === 'files');
}

export default ({ className }: WithClassname) => {
    const fileUploadInput = useRef<HTMLInputElement>(null);
    const folderUploadInput = useRef<HTMLInputElement>(null);

    const [visible, setVisible] = useState(false);
    const timeouts = useRef<NodeJS.Timeout[]>([]);

    const { mutate } = useFileManagerSwr();
    const { addError, clearAndAddHttpError } = useFlashKey('files');

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { clearFileUploads, removeFileUpload, pushFileUpload, setUploadProgress } = ServerContext.useStoreActions(
        (actions) => actions.files
    );

    useEventListener(
        'dragenter',
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isFileOrDirectory(e)) {
                setVisible(true);
            }
        },
        { capture: true }
    );

    useEventListener('dragexit', () => setVisible(false), { capture: true });

    useEventListener('keydown', () => setVisible(false));

    useEffect(() => {
        return () => timeouts.current.forEach(clearTimeout);
    }, []);

    useEffect(() => {
        const handler = () => {
            if (fileUploadInput.current) {
                fileUploadInput.current.click();
            }
        };

        window.addEventListener('luna:keybind:file-upload', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:file-upload', handler as EventListener);
    }, []);

    const folderInputRef = (el: HTMLInputElement | null) => {
        folderUploadInput.current = el;
        if (el) {
            el.setAttribute('webkitdirectory', '');
            el.setAttribute('directory', '');
            el.setAttribute('multiple', '');
        }
    };

    const onUploadProgress = (data: AxiosProgressEvent, name: string) => {
        setUploadProgress({ name, loaded: data.loaded });
    };

    const getUniqueDirectories = (files: File[]): string[] => {
        const dirs = new Set<string>();
        files.forEach((file) => {
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
            if (relativePath) {
                const parts = relativePath.split('/');
                parts.pop();
                let currentPath = '';
                parts.forEach((part) => {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    dirs.add(currentPath);
                });
            }
        });
        return Array.from(dirs).sort((a, b) => a.split('/').length - b.split('/').length);
    };

    const createDirectories = async (directories: string[]): Promise<void> => {
        for (const dir of directories) {
            const parts = dir.split('/');
            const name = parts.pop()!;
            const root = join(directory, parts.join('/')) || directory;
            try {
                await createDirectory(uuid, root, name);
            } catch (error: any) {
                if (!error?.response?.data?.errors?.[0]?.detail?.includes('already exists')) {
                    throw error;
                }
            }
        }
    };

    const onFileSubmission = (files: FileList, isFolder = false) => {
        clearAndAddHttpError();
        const list = Array.from(files);

        if (!isFolder && list.some((file) => !file.type && (!file.size || file.size === 4096))) {
            return addError('Folder uploads are not supported via drag-and-drop. Use the Upload Folder button instead.', 'Error');
        }

        const uploadFile = (file: File, targetDirectory: string, displayName: string) => {
            const controller = new AbortController();
            pushFileUpload({
                name: displayName,
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
                                params: { directory: targetDirectory },
                                onUploadProgress: (data) => onUploadProgress(data, displayName),
                            }
                        )
                        .then(() => timeouts.current.push(setTimeout(() => removeFileUpload(displayName), 500)))
                );
        };

        if (isFolder) {
            const directories = getUniqueDirectories(list);
            createDirectories(directories)
                .then(() => {
                    const uploads = list.map((file) => {
                        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
                        const parts = relativePath.split('/');
                        parts.pop();
                        const targetDir = join(directory, parts.join('/'));
                        return uploadFile(file, targetDir, relativePath);
                    });

                    return Promise.all(uploads.map((fn) => fn()));
                })
                .then(() => mutate())
                .catch((error) => {
                    clearFileUploads();
                    clearAndAddHttpError(error);
                });
        } else {
            const uploads = list.map((file) => uploadFile(file, directory, file.name));

            Promise.all(uploads.map((fn) => fn()))
                .then(() => mutate())
                .catch((error) => {
                    clearFileUploads();
                    clearAndAddHttpError(error);
                });
        }
    };

    return (
        <>
            <Portal>
                <Fade appear in={visible} timeout={75} key={'upload_modal_mask'} unmountOnExit>
                    <ModalMask
                        onClick={() => setVisible(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            setVisible(false);
                            if (!e.dataTransfer?.files.length) return;

                            onFileSubmission(e.dataTransfer.files);
                        }}
                    >
                        <div className={'w-full flex items-center justify-center pointer-events-none'}>
                            <div
                                className={'flex items-center space-x-4 w-full p-6 mx-10 max-w-sm'}
                                style={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    border: '2px dashed var(--color-primary)',
                                    borderRadius: 'var(--border-radius, 8px)',
                                }}
                            >
                                <CloudUploadIcon className={'w-10 h-10 flex-shrink-0'} style={{ color: 'var(--color-primary)' }} />
                                <p className={'font-header flex-1 text-lg text-center'} style={{ color: 'var(--color-base)' }}>
                                    Drag and drop files to upload.
                                </p>
                            </div>
                        </div>
                    </ModalMask>
                </Fade>
            </Portal>
            <input
                type={'file'}
                ref={fileUploadInput}
                css={tw`hidden`}
                onChange={(e) => {
                    if (!e.currentTarget.files) return;

                    onFileSubmission(e.currentTarget.files, false);
                    if (fileUploadInput.current) {
                        fileUploadInput.current.files = null;
                    }
                }}
                multiple
            />
            <input
                type={'file'}
                ref={folderInputRef}
                css={tw`hidden`}
                onChange={(e) => {
                    if (!e.currentTarget.files) return;

                    onFileSubmission(e.currentTarget.files, true);
                    if (folderUploadInput.current) {
                        folderUploadInput.current.value = '';
                    }
                }}
            />
            <div className={`upload_actions flex items-center gap-2 ${className || ''}`}>
                <Button onClick={() => fileUploadInput.current && fileUploadInput.current.click()}>
                    <CloudUploadIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Upload</span>
                </Button>
                <Button onClick={() => folderUploadInput.current && folderUploadInput.current.click()}>
                    <FolderAddIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Folder</span>
                </Button>
            </div>
        </>
    );
};
