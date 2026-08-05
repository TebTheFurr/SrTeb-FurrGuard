import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faEllipsisV,
    faFolderPlus,
    faUpload,
    faCloudUploadAlt,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { CloudUploadIcon, FolderAddIcon } from '@heroicons/react/outline';
import DropdownMenu, { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import UploadButton from '@/components/server/files/UploadButton';
import ImportFromUrlButton from '@/components/server/files/ImportFromUrlButton';
import NewDirectoryButton from '@/components/server/files/NewDirectoryButton';
import ServerIconButton from '@/components/server/files/ServerIconButton';
import FileManagerStatus from '@/components/server/files/FileManagerStatus';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const MenuToggle = styled.button`
    ${tw`flex items-center justify-center transition-colors duration-150`};
    width: 2.5rem;
    height: 2.5rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-muted);

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
    }
`;

const HiddenActions = styled.div`
    ${tw`sr-only`};
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
`;

const MenuDivider = styled.div`
    height: 1px;
    margin: 4px 0;
    background-color: var(--color-neutral);
`;

const TrashMenuRow = styled(DropdownButtonRow)`
    color: #ef4444;

    svg {
        color: #ef4444;
    }

    &:hover {
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.12);
    }
`;

interface Props {
    trashEnabled?: boolean;
    onOpenTrash?: () => void;
}

export default ({ trashEnabled, onOpenTrash }: Props) => {
    const { t } = useTranslation('server');
    const uploadRef = useRef<HTMLDivElement>(null);
    const importRef = useRef<HTMLDivElement>(null);
    const directoryRef = useRef<HTMLDivElement>(null);
    const serverIconRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef<HTMLDivElement>(null);

    const uploadCount = ServerContext.useStoreState((state) => Object.keys(state.files.uploads).length);
    const eggId = ServerContext.useStoreState((state) => state.server.data!.eggId);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.serverIconChanger);
    const iconEnabled = addonSettings?.enabled ?? false;
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const eggAllowed = allowedEggs.length === 0 || allowedEggs.includes(eggId);
    const showServerIcon = iconEnabled && eggAllowed;

    const triggerUpload = (index: number) => {
        const buttons = uploadRef.current?.querySelectorAll('button');
        buttons?.[index]?.click();
    };

    const triggerImport = () => {
        importRef.current?.querySelector('button')?.click();
    };

    const triggerNewDirectory = () => {
        directoryRef.current?.querySelector('button')?.click();
    };

    const triggerServerIcon = () => {
        serverIconRef.current?.querySelector('input[type="file"]')?.click();
    };

    const triggerUploadStatus = () => {
        statusRef.current?.querySelector('button')?.click();
    };

    return (
        <>
            <HiddenActions aria-hidden="true">
                <div ref={uploadRef}>
                    <UploadButton />
                </div>
                <div ref={importRef}>
                    <ImportFromUrlButton />
                </div>
                <div ref={directoryRef}>
                    <NewDirectoryButton />
                </div>
                <div ref={serverIconRef}>
                    <ServerIconButton />
                </div>
                <div ref={statusRef}>
                    <FileManagerStatus />
                </div>
            </HiddenActions>
            <DropdownMenu
                renderToggle={(onClick) => (
                    <MenuToggle type="button" onClick={onClick} aria-label="More actions">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </MenuToggle>
                )}
            >
                <div css={tw`text-sm min-w-[200px]`}>
                    {uploadCount > 0 && (
                        <DropdownButtonRow onClick={triggerUploadStatus}>
                            <CloudUploadIcon css={tw`w-4 h-4 flex-shrink-0`} />
                            <span css={tw`ml-2`}>
                                {t('files.actions.upload')} ({uploadCount})
                            </span>
                        </DropdownButtonRow>
                    )}
                    <DropdownButtonRow onClick={() => triggerUpload(0)}>
                        <CloudUploadIcon css={tw`w-4 h-4 flex-shrink-0`} />
                        <span css={tw`ml-2`}>{t('files.actions.upload')}</span>
                    </DropdownButtonRow>
                    <DropdownButtonRow onClick={() => triggerUpload(1)}>
                        <FolderAddIcon css={tw`w-4 h-4 flex-shrink-0`} />
                        <span css={tw`ml-2`}>Upload Folder</span>
                    </DropdownButtonRow>
                    <DropdownButtonRow onClick={triggerNewDirectory}>
                        <FontAwesomeIcon fixedWidth icon={faFolderPlus} css={tw`text-xs`} />
                        <span css={tw`ml-2`}>{t('files.new_directory.title')}</span>
                    </DropdownButtonRow>
                    <DropdownButtonRow onClick={triggerImport}>
                        <FontAwesomeIcon fixedWidth icon={faUpload} css={tw`text-xs`} />
                        <span css={tw`ml-2`}>Import from URL</span>
                    </DropdownButtonRow>
                    {showServerIcon && (
                        <DropdownButtonRow onClick={triggerServerIcon}>
                            <FontAwesomeIcon fixedWidth icon={faCloudUploadAlt} css={tw`text-xs`} />
                            <span css={tw`ml-2`}>Change Server Icon</span>
                        </DropdownButtonRow>
                    )}
                    {trashEnabled && onOpenTrash && (
                        <>
                            <MenuDivider />
                            <TrashMenuRow onClick={onOpenTrash}>
                                <FontAwesomeIcon fixedWidth icon={faTrash} css={tw`text-xs`} />
                                <span css={tw`ml-2`}>{t('files.trash')}</span>
                            </TrashMenuRow>
                        </>
                    )}
                </div>
            </DropdownMenu>
        </>
    );
};
