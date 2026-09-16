import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpErrorToHuman } from '@/api/http';
import { CSSTransition } from 'react-transition-group';
import Spinner from '@/components/elements/Spinner';
import FileObjectRow from '@/components/server/files/FileObjectRow';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { FileObject } from '@/api/server/files/loadDirectory';
import NewDirectoryButton from '@/components/server/files/NewDirectoryButton';
import { NavLink, useLocation } from 'react-router-dom';
import Can from '@/components/elements/Can';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useDirectorySizes from '@/plugins/useDirectorySizes';
import { DirectorySizeProvider, DirectorySizeLabel } from '@/components/server/files/DirectorySizeContext';
import FileManagerStatus from '@/components/server/files/FileManagerStatus';
import PageHeader from '@/components/elements/ui/PageHeader';
import MassActionsBar from '@/components/server/files/MassActionsBar';
import UploadButton from '@/components/server/files/UploadButton';
import ImportFromUrlButton from '@/components/server/files/ImportFromUrlButton';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useStoreActions, useStoreState } from '@/state/hooks';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FileActionCheckbox } from '@/components/server/files/SelectFileCheckbox';
import { hashToPath, encodePathSegments } from '@/helpers';
import { bytesToString } from '@/lib/formatters';
import { NavLink as RouterNavLink, useRouteMatch } from 'react-router-dom';
import { usePermissions } from '@/plugins/usePermissions';
import { join } from 'pathe';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFileMedical, faSortUp, faSortDown, faList, faCode, faTrash, faGripHorizontal, faFolder, faFileAlt, faFileArchive, faFileImport, faFileImage, faFileVideo, faFileAudio, faSpinner, faTimes, faLock } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import EmptyState from '@/components/elements/EmptyState';
import style from './style.module.css';
import FileManagerIDE from './FileManagerIDE';
import FileDropdownMenu from '@/components/server/files/FileDropdownMenu';
import SelectFileCheckbox from '@/components/server/files/SelectFileCheckbox';
import { usePersistedState } from '@/plugins/usePersistedState';
import useIsMobile from '@/plugins/useIsMobile';
import TrashCanModal from './TrashCanModal';
import MediaViewerModal from './MediaViewerModal';
import useGlobalFileSearch, { SearchResult } from '@/plugins/useGlobalFileSearch';
import ServerIconButton from '@/components/server/files/ServerIconButton';
import FileManagerOverflowMenu from '@/components/server/files/FileManagerOverflowMenu';
import VaultCopyNotice from '@/components/server/vault/VaultCopyNotice';

type SortColumn = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'grid' | 'ide';

interface MediaViewerState {
    visible: boolean;
    path: string;
    name: string;
    size?: number;
}

const ViewToggle = styled.div`
    ${tw`flex items-center`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const ViewButton = styled.button<{ $isActive: boolean }>`
    ${tw`flex items-center gap-2 px-3 py-2 text-sm transition-all duration-150`};
    background-color: ${props => props.$isActive ? 'var(--color-primary)' : 'transparent'};
    color: ${props => props.$isActive ? 'white' : 'var(--color-muted)'};
    border: none;

    &:hover:not(:disabled) {
        background-color: ${props => props.$isActive ? 'var(--color-primary)' : 'var(--color-background)'};
        color: ${props => props.$isActive ? 'white' : 'var(--color-base)'};
    }

    &:not(:last-child) {
        border-right: 1px solid var(--color-neutral);
    }
`;

/** Labels collapse to icon-only on narrow screens so the toolbar still fits. */
const ViewButtonLabel = styled.span`
    ${tw`hidden sm:inline`};
`;

const TrashButton = styled.button`
    ${tw`flex items-center gap-2 px-3 py-2 text-sm transition-all duration-150 rounded-lg`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    color: var(--color-muted);

    &:hover {
        background-color: var(--color-background);
        border-color: var(--color-primary);
        color: var(--color-base);
    }
`;

const SearchInput = styled.input`
    ${tw`w-full pl-12 pr-10 py-3 text-sm transition-all duration-150`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    outline: none;

    &:focus {
        border-color: var(--color-primary);
    }
`;

const GridContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;

    @media (min-width: 640px) {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
`;

const GridCard = styled.div<{ $isSelected?: boolean; $isRestricted?: boolean }>`
    position: relative;
    background-color: var(--color-background-secondary);
    border: 1px solid ${props => props.$isSelected ? 'var(--color-primary)' : 'var(--color-neutral)'};
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
    cursor: ${({ $isRestricted }) => $isRestricted ? 'not-allowed' : 'pointer'};
    opacity: ${({ $isRestricted }) => $isRestricted ? '0.65' : '1'};
`;

const GridCardContent = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 0.75rem 1rem;
    text-decoration: none;
    color: inherit;
`;

const GridCardIcon = styled.div<{ $color: string }>`
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    color: ${props => props.$color};
`;

const GridCardName = styled.div`
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-base);
    text-align: center;
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    padding: 0 0.25rem;
`;

const GridCardMeta = styled.div`
    font-size: 0.65rem;
    color: var(--color-muted);
    text-align: center;
    margin-top: 0.35rem;
`;

const GridCardCheckbox = styled.label`
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 10;
    cursor: pointer;

    input {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        accent-color: var(--color-primary);
    }
`;

const GridCardMenu = styled.div`
    position: absolute;
    top: 0.5rem;
    right: 0;
    z-index: 10;
`;

const SearchProgress = styled.div`
    ${tw`flex items-center gap-2 px-4 py-2 text-xs`};
    color: var(--color-muted);
    border-bottom: 1px solid var(--color-neutral);
    background-color: var(--color-background);
`;

const SearchClear = styled.button`
    ${tw`flex items-center justify-center flex-shrink-0 transition-colors duration-100`};
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--color-muted);
    font-size: 0.75rem;
    cursor: pointer;

    &:hover {
        background-color: var(--color-background);
        color: var(--color-base);
    }
`;

const SearchResultObjectRow: React.FC<{ result: SearchResult }> = ({ result }) => {
    const match = useRouteMatch();
    const [canReadContents] = usePermissions(['file.read-content']);

    const getResultLink = () => {
        if (!result.file.isFile) {
            return `${match.url}#${encodePathSegments(result.path)}`;
        }

        const isJar = result.file.name.split('.').pop()?.toLowerCase() === 'jar';
        if (result.file.isEditable() && canReadContents && !isJar) {
            return `${match.url}/edit#${encodePathSegments(result.path)}`;
        }

        return `${match.url}#${encodePathSegments(result.directory)}`;
    };

    const iconColor = result.file.isRestricted ? 'var(--color-muted)' : getIconColor(result.file);
    const content = (
        <>
            <div
                className="flex-none w-6 mr-3 text-center"
                style={{ color: iconColor }}
            >
                <FontAwesomeIcon icon={result.file.isRestricted ? faLock : getFileIcon(result.file)} />
            </div>
            <div className={style.file_name} style={{ color: result.file.isRestricted ? 'var(--color-muted)' : 'var(--color-base)' }}>
                <div>{result.file.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--color-muted)', marginTop: '0.125rem' }}>
                    {result.directory === '/' ? '/' : result.directory}
                </div>
            </div>
            <div
                className="w-24 text-right mr-4 hidden sm:block text-xs"
                style={{ color: 'var(--color-muted)' }}
            >
                {result.file.isFile ? bytesToString(result.file.size) : '—'}
            </div>
        </>
    );

    return (
        <div
            className={`${style.file_row} ${result.file.isRestricted ? style.restricted : ''}`}
            onContextMenu={(e) => {
                e.preventDefault();
                if (result.file.isRestricted) return;
                window.dispatchEvent(new CustomEvent(`pterodactyl:files:ctx:${result.file.key}`, { detail: { x: e.clientX, y: e.clientY } }));
            }}
        >
            <SelectFileCheckbox name={result.file.name} disabled={result.file.isRestricted} />
            {result.file.isRestricted ? (
                <div className={style.details}>{content}</div>
            ) : (
                <RouterNavLink className={style.details} to={getResultLink()}>
                    {content}
                </RouterNavLink>
            )}
            <FileDropdownMenu file={result.file} directory={result.directory} />
        </div>
    );
};

const SearchResultsList: React.FC<{ results: SearchResult[]; searching: boolean; progress: { scanned: number; found: number } }> = ({ results, searching, progress }) => {
    const { t } = useTranslation('server');

    return (
        <div className={style.file_table}>
            {searching && (
                <SearchProgress>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>{t('files.search_results.scanning', 'Scanning directories... {{scanned}} scanned, {{found}} found', { scanned: progress.scanned, found: progress.found })}</span>
                </SearchProgress>
            )}
            {results.slice(0, 350).map((result) => (
                <SearchResultObjectRow key={result.path} result={result} />
            ))}
            {!searching && results.length === 0 && (
                <EmptyState
                    title={t('files.search_results.no_results_title', 'No results found')}
                    message={t('files.search_results.no_results_message', 'Try a different search term')}
                />
            )}
            {!searching && results.length >= 500 && (
                <SearchProgress>
                    <span>{t('files.search_results.too_many_results', 'Showing first 250 of 500+ matches. Refine your search for better results.')}</span>
                </SearchProgress>
            )}
        </div>
    );
};

const sortFiles = (
    files: FileObject[],
    sortColumn: SortColumn,
    sortDirection: SortDirection
): FileObject[] => {
    const uniqueFiles = files.filter((file, index) => index === 0 || file.name !== files[index - 1].name);

    return [...uniqueFiles].sort((a, b) => {
        if (a.isFile !== b.isFile) {
            return a.isFile ? 1 : -1;
        }

        let comparison = 0;
        switch (sortColumn) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'size':
                comparison = a.size - b.size;
                break;
            case 'modified':
                comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS.filter(e => e !== 'ogg'), 'ogg'];

const getMediaType = (filename: string): 'image' | 'video' | 'audio' | null => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) return 'image';
    if (VIDEO_EXTENSIONS.indexOf(ext) !== -1) return 'video';
    if (AUDIO_EXTENSIONS.indexOf(ext) !== -1) return 'audio';
    return null;
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

const getIconColor = (file: FileObject): string => {
    if (!file.isFile) return 'var(--color-primary)';
    const mediaType = getMediaType(file.name);
    if (mediaType === 'image') return '#10b981';
    if (mediaType === 'video') return '#8b5cf6';
    if (mediaType === 'audio') return '#f59e0b';
    return 'var(--color-muted)';
};

const isManagedEnvFileName = (name: string): boolean => {
    if (name === '.env') {
        return true;
    }

    return name.startsWith('.env.');
};

const useFileManagerState = () => {
    const { t } = useTranslation('server');
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const { hash } = useLocation();
    const { data: files, error, mutate } = useFileManagerSwr();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);

    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const selectedFilesLength = ServerContext.useStoreState((state) => state.files.selectedFiles.length);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [mediaViewer, setMediaViewer] = useState<MediaViewerState>({ visible: false, path: '', name: '' });

    const ignoredFoldersRaw = useStoreState((state) => state.settings.data?.components?.searchIgnoredFolders ?? '');
    const ignoredFolders = ignoredFoldersRaw ? ignoredFoldersRaw.split(',').map(f => f.trim()).filter(Boolean) : [];
    const searchMode = useStoreState((state) => state.settings.data?.components?.searchMode ?? 'global');
    const environmentVariableManager = useStoreState((state) => state.settings.data?.addons?.environmentVariableManager);
    const envManagerAllowedEggs = environmentVariableManager?.allowedEggs ?? [];
    const isEggAllowedForEnvManager = envManagerAllowedEggs.length === 0 || (eggId && envManagerAllowedEggs.includes(eggId));
    const envManagerAccessMode = environmentVariableManager?.accessMode ?? 'both';
    const hideEnvFiles = (environmentVariableManager?.enabled ?? false) && isEggAllowedForEnvManager && envManagerAccessMode === 'sidebar';

    const { results: searchResults, searching, progress } = useGlobalFileSearch(uuid, searchQuery, ignoredFolders, searchMode, directory);
    const isSearching = searchQuery.length >= 2;

    useEffect(() => {
        const handleMediaOpen = (e: CustomEvent<{ path: string; name: string; size?: number }>) => {
            setMediaViewer({
                visible: true,
                path: e.detail.path,
                name: e.detail.name,
                size: e.detail.size,
            });
        };

        window.addEventListener('pterodactyl:files:media', handleMediaOpen as EventListener);
        return () => window.removeEventListener('pterodactyl:files:media', handleMediaOpen as EventListener);
    }, []);

    useEffect(() => {
        clearFlashes('files');
        setSelectedFiles([]);
        setDirectory(hashToPath(hash));
        setSearchQuery('');
    }, [hash]);

    useEffect(() => {
        mutate();
    }, [directory]);

    const onSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sourceFiles = filteredFiles ?? [];
        setSelectedFiles(e.currentTarget.checked ? sourceFiles.filter((file) => !file.isRestricted).map((file) => file.name) : []);
    };

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const filteredFiles = files?.filter((file) => {
        if (file.name === '.trash') {
            return false;
        }

        if (hideEnvFiles && file.isFile && isManagedEnvFileName(file.name)) {
            return false;
        }

        return true;
    });

    const filteredSearchResults = searchResults.filter((result) => {
        if (!hideEnvFiles) {
            return true;
        }

        return !(result.file.isFile && isManagedEnvFileName(result.file.name));
    });

    const getMediaFiles = () => {
        if (!filteredFiles) return [];
        return sortFiles(filteredFiles, sortColumn, sortDirection).filter((f) => {
            const ext = f.name.split('.').pop()?.toLowerCase() || '';
            return f.isFile && !f.isRestricted && MEDIA_EXTENSIONS.indexOf(ext) !== -1;
        });
    };

    const navigateMedia = (direction: 'prev' | 'next') => {
        const mFiles = getMediaFiles();
        const currentIndex = mFiles.findIndex((f) => f.name === mediaViewer.name);
        if (currentIndex === -1) return;

        const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= mFiles.length) return;

        const newFile = mFiles[newIndex];
        setMediaViewer({
            visible: true,
            path: `${directory}/${newFile.name}`.replace(/\/+/g, '/'),
            name: newFile.name,
            size: newFile.size,
        });
    };

    const sortedFiles = filteredFiles ? sortFiles(filteredFiles.slice(0, 250), sortColumn, sortDirection) : [];
    const mediaFiles = getMediaFiles();
    const currentMediaIndex = mediaFiles.findIndex((f) => f.name === mediaViewer.name);

    // Folder sizes are not part of the directory listing, so each visible folder
    // is resolved separately. Restricted folders are skipped: the panel rejects
    // those lookups anyway.
    const directorySizes = useDirectorySizes(
        uuid,
        directory,
        sortedFiles.filter((file) => !file.isFile && !file.isRestricted).map((file) => file.name)
    );

    return {
        t, id, files, error, mutate, filteredFiles, sortedFiles, directorySizes,
        selectedFilesLength, onSelectAllClick,
        searchQuery, setSearchQuery, searching, searchResults: filteredSearchResults, isSearching, progress, searchMode,
        sortColumn, sortDirection, handleSort,
        mediaViewer, setMediaViewer, navigateMedia, mediaFiles, currentMediaIndex,
    };
};

const FileSortIndicator: React.FC<{ column: SortColumn; activeColumn: SortColumn; direction: SortDirection }> = ({ column, activeColumn, direction }) => {
    if (activeColumn !== column) return null;
    return (
        <FontAwesomeIcon
            icon={direction === 'asc' ? faSortUp : faSortDown}
            className="ml-2"
            style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}
        />
    );
};

interface FileViewLayoutProps {
    state: ReturnType<typeof useFileManagerState>;
    children: React.ReactNode;
    trashEnabled?: boolean;
    onOpenTrash?: () => void;
}

const FileViewLayout: React.FC<FileViewLayoutProps> = ({ state, children, trashEnabled, onOpenTrash }) => {
    const {
        t, id, files, error, mutate, filteredFiles,
        selectedFilesLength, onSelectAllClick,
        searchQuery, setSearchQuery, searching, searchResults, isSearching, progress, searchMode,
        mediaViewer, setMediaViewer, navigateMedia, mediaFiles, currentMediaIndex,
    } = state;

    const isMobile = useIsMobile();

    if (error) {
        return <ServerError message={httpErrorToHuman(error)} onRetry={() => mutate()} />;
    }

    const searchBar = (
        <div className="relative mb-4">
            <div
                className="absolute left-4 top-1/2 transform -translate-y-1/2"
                style={{ color: searching ? 'var(--color-primary)' : 'var(--color-muted)' }}
            >
                <FontAwesomeIcon icon={searching ? faSpinner : faSearch} spin={searching} />
            </div>
            <SearchInput
                type="text"
                placeholder={
                    searchMode === 'current_directory'
                        ? t('files.search_current_folder', 'Search this folder...')
                        : t('files.search_all', 'Search all files and folders...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
                <SearchClear onClick={() => setSearchQuery('')}>
                    <FontAwesomeIcon icon={faTimes} />
                </SearchClear>
            )}
        </div>
    );

    const breadcrumbs = (
        <FileManagerBreadcrumbs
            className={isMobile ? 'w-full overflow-x-auto' : undefined}
            renderLeft={
                <FileActionCheckbox
                    type={'checkbox'}
                    css={tw`mr-3`}
                    checked={selectedFilesLength === (filteredFiles?.filter((file) => !file.isRestricted).length === 0 ? -1 : filteredFiles?.filter((file) => !file.isRestricted).length)}
                    onChange={onSelectAllClick}
                />
            }
        />
    );

    const desktopActions = (
        <Can action={'file.create'}>
            <div className={`${style.manager_actions} hidden md:flex`}>
                <FileManagerStatus />
                <ServerIconButton />
                <ImportFromUrlButton />
                <NewDirectoryButton />
                <UploadButton />
                <NavLink to={`/server/${id}/files/new${window.location.hash}`}>
                    <Button>
                        <FontAwesomeIcon icon={faFileMedical} className="w-4 h-4 mr-2" />
                        {t('files.actions.new_file')}
                    </Button>
                </NavLink>
            </div>
        </Can>
    );

    const mobileActions = (
        <Can action={'file.create'}>
            <div className="flex items-center justify-between gap-2 mb-4 md:hidden">
                <NavLink to={`/server/${id}/files/new${window.location.hash}`} className="flex-1 min-w-0">
                    <Button className="w-full">
                        <FontAwesomeIcon icon={faFileMedical} className="w-4 h-4 mr-2" />
                        {t('files.actions.new_file')}
                    </Button>
                </NavLink>
                <FileManagerOverflowMenu trashEnabled={trashEnabled} onOpenTrash={onOpenTrash} />
            </div>
        </Can>
    );

    return (
        <>
            <MediaViewerModal
                visible={mediaViewer.visible}
                filePath={mediaViewer.path}
                fileName={mediaViewer.name}
                fileSize={mediaViewer.size}
                onDismissed={() => setMediaViewer({ visible: false, path: '', name: '' })}
                onPrevious={() => navigateMedia('prev')}
                onNext={() => navigateMedia('next')}
                hasPrevious={currentMediaIndex > 0}
                hasNext={currentMediaIndex < mediaFiles.length - 1 && currentMediaIndex !== -1}
            />
            <ErrorBoundary>
                {isMobile ? (
                    <>
                        {searchBar}
                        <div className="w-full mb-4 min-w-0">
                            {breadcrumbs}
                        </div>
                        {mobileActions}
                    </>
                ) : (
                    <>
                        <div className={'flex items-start flex-wrap-reverse md:flex-nowrap mb-4 gap-4'}>
                            {breadcrumbs}
                            {desktopActions}
                        </div>
                        {searchBar}
                    </>
                )}
            </ErrorBoundary>
            {isSearching ? (
                <>
                    <SearchResultsList results={searchResults} searching={searching} progress={progress} />
                    <MassActionsBar />
                </>
            ) : !files ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    {!filteredFiles?.length ? (
                        <EmptyState
                            title={t('files.empty.title')}
                            message={t('files.empty.message')}
                        />
                    ) : (
                        <CSSTransition classNames={'fade'} timeout={150} appear in>
                            <div>
                                {filteredFiles.length > 250 && (
                                    <div
                                        className="mb-4 p-3 rounded-lg"
                                        style={{
                                            backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                            border: '1px solid #eab308',
                                            borderRadius: 'var(--border-radius, 8px)',
                                            color: '#eab308'
                                        }}
                                    >
                                        <p className="text-sm text-center">
                                            {t('files.directory_large')}
                                        </p>
                                    </div>
                                )}
                                {children}
                                <MassActionsBar />
                            </div>
                        </CSSTransition>
                    )}
                </>
            )}
        </>
    );
};

const ListViewContent: React.FC<{ trashEnabled?: boolean; onOpenTrash?: () => void }> = ({ trashEnabled, onOpenTrash }) => {
    const state = useFileManagerState();
    const { t, sortedFiles, sortColumn, sortDirection, handleSort } = state;

    return (
        <FileViewLayout state={state} trashEnabled={trashEnabled} onOpenTrash={onOpenTrash}>
            <DirectorySizeProvider value={state.directorySizes}>
            <div className={style.file_table}>
                <div className={style.file_header}>
                    <div
                        className="flex-1 flex items-center cursor-pointer select-none hover:text-[var(--color-base)] transition-colors"
                        onClick={() => handleSort('name')}
                    >
                        <span className="w-6 mr-3" />
                        <span>{t('files.name')}</span>
                        <FileSortIndicator column="name" activeColumn={sortColumn} direction={sortDirection} />
                    </div>
                    <div
                        className="w-24 text-right mr-4 hidden sm:flex items-center justify-end cursor-pointer select-none hover:text-[var(--color-base)] transition-colors"
                        onClick={() => handleSort('size')}
                    >
                        <span>{t('files.size')}</span>
                        <FileSortIndicator column="size" activeColumn={sortColumn} direction={sortDirection} />
                    </div>
                    <div
                        className="w-48 text-right mr-4 hidden md:flex items-center justify-end cursor-pointer select-none hover:text-[var(--color-base)] transition-colors"
                        onClick={() => handleSort('modified')}
                    >
                        <span>{t('files.modified')}</span>
                        <FileSortIndicator column="modified" activeColumn={sortColumn} direction={sortDirection} />
                    </div>
                    <div className="w-8" />
                </div>
                {sortedFiles.map((file) => (
                    <FileObjectRow key={file.key} file={file} />
                ))}
            </div>
            </DirectorySizeProvider>
        </FileViewLayout>
    );
};

const GridFileCard: React.FC<{ file: FileObject }> = ({ file }) => {
    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const selectedFiles = ServerContext.useStoreState((state) => state.files.selectedFiles);
    const match = useRouteMatch();

    const isSelected = selectedFiles.indexOf(file.name) >= 0;
    const mediaType = file.isFile ? getMediaType(file.name) : null;
    const isJar = file.name.split('.').pop()?.toLowerCase() === 'jar';

    const handleMediaClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (file.isRestricted) return;
        const filePath = join(directory, file.name);
        window.dispatchEvent(new CustomEvent('pterodactyl:files:media', {
            detail: {
                path: filePath,
                name: file.name,
                size: file.size,
            }
        }));
    };

    const getNavTarget = () => {
        if (file.isRestricted) {
            return null;
        }

        if (file.isFile && (!file.isEditable() || !canReadContents || isJar)) {
            return null;
        }
        if (!file.isFile && !canRead) {
            return null;
        }
        return `${match.url}${file.isFile ? '/edit' : ''}#${encodePathSegments(join(directory, file.name))}`;
    };

    const navTarget = getNavTarget();
    const showMediaClick = mediaType && canReadContents && !isJar && !file.isRestricted;

    const cardContent = (
        <GridCardContent>
            <GridCardIcon $color={file.isRestricted ? 'var(--color-muted)' : getIconColor(file)}>
                <FontAwesomeIcon icon={file.isRestricted ? faLock : getFileIcon(file)} />
            </GridCardIcon>
            <GridCardName title={file.name} style={{ color: file.isRestricted ? 'var(--color-muted)' : undefined }}>{file.name}</GridCardName>
            <GridCardMeta>
                {file.isFile ? bytesToString(file.size) : <DirectorySizeLabel name={file.name} />}
            </GridCardMeta>
        </GridCardContent>
    );

    return (
        <GridCard
            $isSelected={isSelected}
            $isRestricted={file.isRestricted}
            onContextMenu={(e) => {
                e.preventDefault();
                if (file.isRestricted) return;
                window.dispatchEvent(new CustomEvent(`pterodactyl:files:ctx:${file.key}`, { detail: { x: e.clientX, y: e.clientY } }));
            }}
        >
            <GridCardCheckbox onClick={(e) => e.stopPropagation()}>
                <SelectFileCheckbox name={file.name} disabled={file.isRestricted} />
            </GridCardCheckbox>
            <GridCardMenu onClick={(e) => e.stopPropagation()}>
                <FileDropdownMenu file={file} />
            </GridCardMenu>
            {showMediaClick ? (
                <div onClick={handleMediaClick}>{cardContent}</div>
            ) : navTarget ? (
                <RouterNavLink to={navTarget} style={{ textDecoration: 'none' }}>
                    {cardContent}
                </RouterNavLink>
            ) : (
                cardContent
            )}
        </GridCard>
    );
};

const GridViewContent: React.FC<{ trashEnabled?: boolean; onOpenTrash?: () => void }> = ({ trashEnabled, onOpenTrash }) => {
    const state = useFileManagerState();

    return (
        <FileViewLayout state={state} trashEnabled={trashEnabled} onOpenTrash={onOpenTrash}>
            <DirectorySizeProvider value={state.directorySizes}>
                <GridContainer>
                    {state.sortedFiles.map((file) => (
                        <GridFileCard key={file.key} file={file} />
                    ))}
                </GridContainer>
            </DirectorySizeProvider>
        </FileViewLayout>
    );
};

export default () => {
    const { t } = useTranslation('server');
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const [viewMode, setViewMode] = usePersistedState<ViewMode>(`${serverId}:file_manager_view`, 'list');
    const [showTrash, setShowTrash] = useState(false);
    const { mutate } = useFileManagerSwr();
    const isMobile = useIsMobile();
    const trashEnabled = useStoreState((state) => state.settings.data?.components?.trashEnabled ?? true);

    useEffect(() => {
        if (isMobile && viewMode === 'ide') {
            setViewMode('list');
        }
    }, [isMobile]);

    useEffect(() => {
        const handler = () => {
            setViewMode((current) => {
                if (current === 'list') {
                    return 'grid';
                }
                return 'list';
            });
        };

        window.addEventListener('luna:keybind:file-toggle-layout', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:file-toggle-layout', handler as EventListener);
    }, [setViewMode]);

    return (
        <ServerContentBlock title={t('files.title')} showFlashKey={'files'}>
            {trashEnabled && (
                <TrashCanModal
                    visible={showTrash}
                    onDismissed={() => setShowTrash(false)}
                    onRestored={() => mutate()}
                />
            )}
            <PageHeader
                title={t('files.title')}
                description={t('files.subtitle')}
                actions={
                    <>
                        {trashEnabled && (
                            <TrashButton onClick={() => setShowTrash(true)} title={t('files.trash')}>
                                <FontAwesomeIcon icon={faTrash} />
                                <ViewButtonLabel>{t('files.trash')}</ViewButtonLabel>
                            </TrashButton>
                        )}
                        <ViewToggle>
                            <ViewButton
                                $isActive={viewMode === 'list'}
                                onClick={() => setViewMode('list')}
                                title={t('files.list_view')}
                            >
                                <FontAwesomeIcon icon={faList} />
                                <ViewButtonLabel>{t('files.list')}</ViewButtonLabel>
                            </ViewButton>
                            <ViewButton
                                $isActive={viewMode === 'grid'}
                                onClick={() => setViewMode('grid')}
                                title={t('files.grid_view')}
                            >
                                <FontAwesomeIcon icon={faGripHorizontal} />
                                <ViewButtonLabel>{t('files.grid')}</ViewButtonLabel>
                            </ViewButton>
                            <ViewButton
                                $isActive={viewMode === 'ide'}
                                onClick={() => setViewMode('ide')}
                                title={t('files.ide_view')}
                            >
                                <FontAwesomeIcon icon={faCode} />
                                <ViewButtonLabel>{t('files.ide')}</ViewButtonLabel>
                            </ViewButton>
                        </ViewToggle>
                    </>
                }
            />
            <VaultCopyNotice />
            {viewMode === 'list' && (
                <ListViewContent trashEnabled={trashEnabled} onOpenTrash={() => setShowTrash(true)} />
            )}
            {viewMode === 'grid' && (
                <GridViewContent trashEnabled={trashEnabled} onOpenTrash={() => setShowTrash(true)} />
            )}
            {viewMode === 'ide' && <FileManagerIDE />}
        </ServerContentBlock>
    );
};
