import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFileArchive, faFileImport, faFolder, faFileImage, faFileVideo, faFileAudio, faLock } from '@fortawesome/free-solid-svg-icons';
import { encodePathSegments } from '@/helpers';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import React, { memo } from 'react';
import { FileObject } from '@/api/server/files/loadDirectory';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import { ServerContext } from '@/state/server';
import { NavLink, useRouteMatch, useHistory } from 'react-router-dom';
import isEqual from 'react-fast-compare';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'pathe';
import { bytesToString } from '@/lib/formatters';
import styles from './style.module.css';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

const getMediaType = (filename: string): 'image' | 'video' | 'audio' | null => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) return 'image';
    if (VIDEO_EXTENSIONS.indexOf(ext) !== -1) return 'video';
    if (AUDIO_EXTENSIONS.indexOf(ext) !== -1) return 'audio';
    return null;
};

const isJarFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext === 'jar';
};

const isManagedEnvFile = (filename: string): boolean => {
    if (filename === '.env') {
        return true;
    }

    return filename.startsWith('.env.');
};

const getFileIcon = (file: FileObject) => {
    if (!file.isFile) return faFolder;
    if (file.isSymlink) return faFileImport;
    if (file.isArchiveType()) return faFileArchive;
    
    const mediaType = getMediaType(file.name);
    if (mediaType === 'image') return faFileImage;
    if (mediaType === 'video') return faFileVideo;
    if (mediaType === 'audio') return faFileAudio;
    
    return faFileAlt;
};

const Clickable: React.FC<{ file: FileObject }> = memo(({ file, children }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const match = useRouteMatch();
    const history = useHistory();
    const addonSettings = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.serverPropertiesEditor);
    const environmentVariableManager = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.environmentVariableManager);

    const mediaType = file.isFile ? getMediaType(file.name) : null;
    const isJar = file.isFile ? isJarFile(file.name) : false;

    if (file.isRestricted) {
        return <div className={styles.details}>{children}</div>;
    }

    const isServerPropertiesFile = file.isFile && file.name === 'server.properties' && directory === '/';
    const propertiesEditorEnabled = addonSettings?.enabled ?? false;
    const canAccessViaFile = addonSettings?.accessMode === 'file' || addonSettings?.accessMode === 'both';
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const isEggAllowed = allowedEggs.length === 0 || (eggId && allowedEggs.includes(eggId));
    const shouldUsePropertiesEditor = isServerPropertiesFile && propertiesEditorEnabled && canAccessViaFile && isEggAllowed;

    const envFile = file.isFile && isManagedEnvFile(file.name);
    const envManagerEnabled = environmentVariableManager?.enabled ?? false;
    const envManagerCanAccessViaFile = environmentVariableManager?.accessMode === 'file' || environmentVariableManager?.accessMode === 'both';
    const envManagerAllowedEggs = environmentVariableManager?.allowedEggs ?? [];
    const envManagerEggAllowed = envManagerAllowedEggs.length === 0 || (eggId && envManagerAllowedEggs.includes(eggId));
    const shouldUseEnvironmentVariablesEditor = envFile && envManagerEnabled && envManagerCanAccessViaFile && envManagerEggAllowed;

    const handleMediaClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const filePath = join(directory, file.name);
        window.dispatchEvent(new CustomEvent('pterodactyl:files:media', { 
            detail: { 
                path: filePath, 
                name: file.name,
                size: file.size,
            } 
        }));
    };

    const handlePropertiesClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const serverMatch = match.url.match(/\/server\/[^/]+/);
        if (serverMatch) {
            history.push(`${serverMatch[0]}/properties`);
        }
    };

    const handleEnvironmentVariablesClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const serverMatch = match.url.match(/\/server\/[^/]+/);
        if (serverMatch) {
            const filePath = join(directory, file.name);
            history.push(`${serverMatch[0]}/environment-variables?path=${encodeURIComponent(filePath)}`);
        }
    };

    if (shouldUsePropertiesEditor) {
        return (
            <div className={styles.details} onClick={handlePropertiesClick} style={{ cursor: 'pointer' }}>
                {children}
            </div>
        );
    }

    if (shouldUseEnvironmentVariablesEditor) {
        return (
            <div className={styles.details} onClick={handleEnvironmentVariablesClick} style={{ cursor: 'pointer' }}>
                {children}
            </div>
        );
    }

    if ((file.isFile && (!file.isEditable() || !canReadContents || isJar)) || (!file.isFile && !canRead)) {
        if (mediaType && canReadContents && !isJar) {
            return (
                <div className={styles.details} onClick={handleMediaClick} style={{ cursor: 'pointer' }}>
                    {children}
                </div>
            );
        }
        return <div className={styles.details}>{children}</div>;
    }

    if (mediaType) {
        return (
            <div className={styles.details} onClick={handleMediaClick} style={{ cursor: 'pointer' }}>
                {children}
            </div>
        );
    }

    return (
        <NavLink
            className={styles.details}
            to={`${match.url}${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`}
        >
            {children}
        </NavLink>
    );
}, isEqual);

const FileObjectRow = ({ file }: { file: FileObject }) => {
    const mediaType = file.isFile ? getMediaType(file.name) : null;
    const iconColor = file.isRestricted ? 'var(--color-muted)' :
                      !file.isFile ? 'var(--color-primary)' : 
                      mediaType === 'image' ? '#10b981' :
                      mediaType === 'video' ? '#8b5cf6' :
                      mediaType === 'audio' ? '#f59e0b' :
                      'var(--color-muted)';

    return (
        <div
            className={`${styles.file_row} ${file.isRestricted ? styles.restricted : ''}`}
            key={file.name}
            onContextMenu={(e) => {
                e.preventDefault();
                if (file.isRestricted) return;
                window.dispatchEvent(new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: { x: e.clientX, y: e.clientY } }));
            }}
        >
            <SelectFileCheckbox name={file.name} disabled={file.isRestricted} />
            <Clickable file={file}>
                <div 
                    className="flex-none w-6 mr-3 text-center"
                    style={{ color: iconColor }}
                >
                    <FontAwesomeIcon icon={file.isRestricted ? faLock : getFileIcon(file)} />
                </div>
                <div className={`${styles.file_name} ${file.isRestricted ? styles.restricted_name : ''}`} style={{ color: 'var(--color-base)' }}>
                    {file.name}
                </div>
                <div 
                    className="w-24 text-right mr-4 hidden sm:block text-xs"
                    style={{ color: 'var(--color-muted)' }}
                >
                    {file.isFile ? bytesToString(file.size) : '—'}
                </div>
                <div 
                    className="w-48 text-right mr-4 hidden md:block text-xs"
                    style={{ color: 'var(--color-muted)' }}
                    title={file.modifiedAt.toString()}
                >
                    {Math.abs(differenceInHours(file.modifiedAt, new Date())) > 48
                        ? format(file.modifiedAt, 'MMM do, yyyy h:mma')
                        : formatDistanceToNow(file.modifiedAt, { addSuffix: true })}
                </div>
            </Clickable>
            <FileDropdownMenu file={file} />
        </div>
    );
};

export default memo(FileObjectRow, (prevProps, nextProps) => {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const { isArchiveType, isEditable, ...prevFile } = prevProps.file;
    const { isArchiveType: nextIsArchiveType, isEditable: nextIsEditable, ...nextFile } = nextProps.file;
    /* eslint-enable @typescript-eslint/no-unused-vars */

    return isEqual(prevFile, nextFile);
});
