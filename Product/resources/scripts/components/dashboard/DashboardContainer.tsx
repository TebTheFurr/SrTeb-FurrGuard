import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import FolderCard from '@/components/dashboard/FolderCard';
import CreateFolderButton from '@/components/dashboard/CreateFolderButton';
import MoveServerModal from '@/components/dashboard/MoveServerModal';

import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import PageHeader from '@/components/elements/ui/PageHeader';
import MetaChip from '@/components/elements/ui/MetaChip';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import {
    getFolders,
    getFolder,
    ServerFolder,
    FoldersResponse,
    addServerToFolder,
    removeServerFromFolder,
    updateFolder,
} from '@/api/folders';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faHome, faSearch, faServer, faTimes } from '@fortawesome/free-solid-svg-icons';
import styled, { css } from 'styled-components/macro';
import {
    closestCorners,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MouseSensor,
    TouchSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SearchContainer = styled.div`
    ${tw`relative mb-4`};
`;

const SearchInput = styled.input`
    ${tw`w-full py-3 pl-11 pr-10 text-sm transition-all duration-150`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    color: var(--color-base);
    border-radius: var(--border-radius, 8px);

    &::placeholder {
        color: var(--color-muted);
    }

    &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }
`;

const SearchIconWrapper = styled.div`
    ${tw`absolute left-4 top-0 bottom-0 flex items-center`};
    color: var(--color-muted);
    pointer-events: none;
    font-size: 0.875rem;
`;

const SearchClearButton = styled.button`
    ${tw`absolute right-3 top-0 bottom-0 flex items-center justify-center w-6 my-auto rounded-full transition-colors duration-150`};
    color: var(--color-muted);
    font-size: 0.75rem;
    height: fit-content;
    padding: 4px 0;

    &:hover {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }
`;

const BreadcrumbNav = styled.div`
    ${tw`flex items-center gap-2 mb-4`};
    flex-wrap: wrap;
`;

const BreadcrumbButton = styled.button`
    ${tw`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-150`};
    background-color: var(--color-background-secondary);
    border: 2px solid var(--color-neutral);
    color: var(--color-muted);
    font-size: 0.875rem;
    font-weight: 500;

    &:hover {
        border-color: var(--color-primary);
        color: var(--color-base);
    }
`;

const SortableItemShell = styled.div<{ $isDragging?: boolean }>`
    ${tw`relative`};
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-user-drag: none;

    a,
    button {
        -webkit-touch-callout: none;
        -webkit-user-drag: none;
        user-select: none;
        -webkit-user-select: none;
    }

    ${({ $isDragging }) =>
        $isDragging &&
        css`
            z-index: 40;
            cursor: grabbing;
            filter: drop-shadow(0 22px 34px rgba(0, 0, 0, 0.22));
        `}
`;

const TogglePanel = styled.div`
    ${tw`flex items-center gap-2 px-3 py-2 rounded-lg`};
    background-color: color-mix(in srgb, var(--color-background-secondary) 82%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-neutral) 84%, transparent);
`;

const ToggleText = styled.p`
    ${tw`uppercase text-xs`};
    margin: 0;
    letter-spacing: 0.06em;
    transition: color 180ms ease;
`;

type DraggedItem =
    | {
          type: 'server';
          id: number;
          sourceFolderId: number | null;
      }
    | {
          type: 'folder';
          id: number;
          parentId: number | null;
      };

type ServerOrderMap = Record<string, number[]>;
type FolderOrderMap = Record<string, number[]>;

const FOLDER_PAGE_SIZE = 25;

const getServerOrderFolderKey = (folderId: number | null): string =>
    folderId === null ? 'root' : `folder:${folderId}`;
const getFolderOrderParentKey = (folderId: number | null): string =>
    folderId === null ? 'root' : `folder:${folderId}`;
const getServerDragId = (serverId: number): string => `server:${serverId}`;
const getFolderDragId = (folderId: number): string => `folder:${folderId}`;
const getFolderDropId = (folderId: number | null): string =>
    folderId === null ? 'folder-drop:root' : `folder-drop:${folderId}`;

const applyServerOrder = (servers: Server[], orderedIds?: number[]): Server[] => {
    if (!orderedIds || !orderedIds.length) {
        return servers;
    }

    const orderMap = new Map<number, number>(orderedIds.map((id, index) => [id, index]));
    const maxKnownOrder = orderedIds.length;

    return [...servers].sort((a, b) => {
        const aId = Number(a.internalId);
        const bId = Number(b.internalId);
        const aOrder = orderMap.get(aId) ?? maxKnownOrder;
        const bOrder = orderMap.get(bId) ?? maxKnownOrder;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return 0;
    });
};

const applyFolderOrder = (folders: ServerFolder[], orderedIds?: number[]): ServerFolder[] => {
    if (!orderedIds || !orderedIds.length) {
        return folders;
    }

    const orderMap = new Map<number, number>(orderedIds.map((id, index) => [id, index]));
    const maxKnownOrder = orderedIds.length;

    return [...folders].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? maxKnownOrder;
        const bOrder = orderMap.get(b.id) ?? maxKnownOrder;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return 0;
    });
};

const parseDragId = (id: string): DraggedItem | null => {
    const [type, rawId] = id.split(':');
    const numericId = Number(rawId);

    if (!Number.isFinite(numericId)) {
        return null;
    }

    if (type === 'server') {
        return {
            type: 'server',
            id: numericId,
            sourceFolderId: null,
        };
    }

    if (type === 'folder') {
        return {
            type: 'folder',
            id: numericId,
            parentId: null,
        };
    }

    return null;
};

const parseFolderDropId = (id: string): number | null | undefined => {
    if (id === getFolderDropId(null)) {
        return null;
    }

    if (!id.startsWith('folder-drop:')) {
        return undefined;
    }

    const folderId = Number(id.replace('folder-drop:', ''));
    return Number.isFinite(folderId) ? folderId : undefined;
};

const SortableDashboardItem = ({
    id,
    disabled,
    children,
}: {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled,
    });

    return (
        <SortableItemShell
            ref={setNodeRef}
            $isDragging={isDragging}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                cursor: disabled ? undefined : isDragging ? 'grabbing' : 'grab',
            }}
            onContextMenu={(event) => {
                if (!disabled) {
                    event.preventDefault();
                }
            }}
            {...attributes}
            {...listeners}
        >
            {children}
        </SortableItemShell>
    );
};

const DroppableBreadcrumbButton = ({
    id,
    active,
    activeColor,
    children,
    onClick,
}: {
    id: string;
    active?: boolean;
    activeColor?: string;
    children: React.ReactNode;
    onClick: () => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: {
            type: 'breadcrumb',
            accepts: ['server', 'folder'],
        },
    });

    return (
        <BreadcrumbButton
            ref={setNodeRef}
            onClick={onClick}
            style={{
                ...(active
                    ? {
                          borderColor: activeColor || 'var(--color-primary)',
                          color: 'var(--color-base)',
                          backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                      }
                    : {}),
                ...(isOver
                    ? {
                          borderColor: activeColor || 'var(--color-primary)',
                          color: 'var(--color-base)',
                          backgroundColor: activeColor
                              ? `${activeColor}18`
                              : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          boxShadow: `0 0 0 4px ${
                              activeColor
                                  ? `${activeColor}30`
                                  : 'color-mix(in srgb, var(--color-primary) 25%, transparent)'
                          }`,
                          transform: 'scale(1.02)',
                      }
                    : {}),
            }}
        >
            {children}
        </BreadcrumbButton>
    );
};

const fetchAllServerPages = async (params: { type?: string }): Promise<PaginatedResult<Server>> => {
    const allItems: Server[] = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
        const result = await getServers({ ...params, page: currentPage, per_page: 100 });
        allItems.push(...result.items);
        totalPages = result.pagination.totalPages;
        currentPage++;
    } while (currentPage <= totalPages);

    return {
        items: allItems,
        pagination: {
            total: allItems.length,
            count: allItems.length,
            perPage: allItems.length,
            currentPage: 1,
            totalPages: 1,
        },
    };
};

const serverMatchesSearch = (server: Server, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    if (server.name.toLowerCase().includes(lowerQuery)) return true;
    if (server.uuid.toLowerCase() === lowerQuery || server.uuid.toLowerCase().startsWith(lowerQuery)) return true;
    if (String(server.id).toLowerCase() === lowerQuery) return true;
    if (server.externalId && server.externalId.toLowerCase() === lowerQuery) return true;
    if (
        server.allocations?.some((allocation) => {
            const ip = String(allocation.ip || '').toLowerCase();
            const port = String(allocation.port || '');
            const ipPort = `${ip}:${port}`;
            if (ip.includes(lowerQuery)) return true;
            if (ipPort.includes(lowerQuery)) return true;
            if (lowerQuery.startsWith(':') && port.startsWith(lowerQuery.slice(1))) return true;
            return false;
        })
    ) {
        return true;
    }
    return false;
};

const folderServerMatchesSearch = (server: { name: string; uuid: string }, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    if (server.name.toLowerCase().includes(lowerQuery)) return true;
    if (server.uuid.toLowerCase() === lowerQuery || server.uuid.toLowerCase().startsWith(lowerQuery)) return true;
    return false;
};

const folderMatchesSearch = (folder: ServerFolder, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    if (folder.name.toLowerCase().includes(lowerQuery)) return true;
    if (folder.servers.some((s) => folderServerMatchesSearch(s, query))) return true;
    return folder.children.some((child) => folderMatchesSearch(child, query));
};

export default () => {
    const { t } = useTranslation('dashboard');
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');
    const folderParam = new URLSearchParams(search).get('folder');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(
        folderParam && /^[0-9]+$/.test(folderParam) ? parseInt(folderParam, 10) : null
    );
    const [currentFolder, setCurrentFolder] = useState<ServerFolder | null>(null);
    const [folderPath, setFolderPath] = useState<ServerFolder[]>([]);
    const [moveModalServer, setMoveModalServer] = useState<{ id: number; name: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);
    const [serverOrderByFolder, setServerOrderByFolder] = usePersistedState<ServerOrderMap>(
        `${uuid}:dashboard_server_order`,
        {}
    );
    const [folderOrderByParent, setFolderOrderByParent] = usePersistedState<FolderOrderMap>(
        `${uuid}:dashboard_folder_order`,
        {}
    );
    const serverListLayout = useStoreState((state) => state.settings.data?.layout?.serverListLayout ?? 'list');
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 300,
                tolerance: 15,
            },
        })
    );

    const serverTypeParam = showOnlyAdmin && rootAdmin ? 'admin' : undefined;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const {
        data: servers,
        error,
        mutate: mutateServers,
    } = useSWR<PaginatedResult<Server>>(['/api/client/servers', serverTypeParam], () =>
        fetchAllServerPages({
            type: serverTypeParam,
        })
    );

    const { data: foldersData, mutate: mutateFolders } = useSWR<FoldersResponse>('/api/client/folders', getFolders);

    const refreshAll = useCallback(() => {
        mutateFolders();
        mutateServers();
        if (currentFolderId) {
            getFolder(currentFolderId)
                .then(setCurrentFolder)
                .catch(() => {
                    setCurrentFolderId(null);
                    setCurrentFolder(null);
                });
        }
    }, [mutateFolders, mutateServers, currentFolderId]);

    const findFolderSlugById = useCallback((folders: ServerFolder[], folderId: number): string | null => {
        for (const folder of folders) {
            if (folder.id === folderId) {
                return folder.slug;
            }

            const childSlug = findFolderSlugById(folder.children || [], folderId);
            if (childSlug !== null) {
                return childSlug;
            }
        }

        return null;
    }, []);

    useEffect(() => {
        const param = new URLSearchParams(search).get('folder');

        if (!param) {
            setCurrentFolderId((current) => (current === null ? current : null));
            return;
        }

        if (/^[0-9]+$/.test(param)) {
            const numericFolderId = parseInt(param, 10);
            setCurrentFolderId((current) => (current === numericFolderId ? current : numericFolderId));
            return;
        }

        if (!foldersData) {
            return;
        }

        const findFolderBySlug = (folders: ServerFolder[], slug: string): ServerFolder | null => {
            for (const folder of folders) {
                if (folder.slug === slug) {
                    return folder;
                }

                const found = findFolderBySlug(folder.children || [], slug);
                if (found) {
                    return found;
                }
            }

            return null;
        };

        const matchedFolder = findFolderBySlug(foldersData.data || [], param);
        setCurrentFolderId((current) => (current === matchedFolder?.id ? current : matchedFolder?.id ?? null));
    }, [search, foldersData]);

    useEffect(() => {
        if (currentFolderId) {
            getFolder(currentFolderId)
                .then((folder) => {
                    setCurrentFolder(folder);
                    const buildPath = async () => {
                        const path: ServerFolder[] = [folder];
                        let parentId = folder.parent_id;
                        while (parentId) {
                            const parent = await getFolder(parentId);
                            path.unshift(parent);
                            parentId = parent.parent_id;
                        }
                        setFolderPath(path);
                    };
                    buildPath();
                })
                .catch(() => {
                    setCurrentFolderId(null);
                    setCurrentFolder(null);
                });
        } else {
            setCurrentFolder(null);
            setFolderPath([]);
        }
    }, [currentFolderId]);

    useEffect(() => {
        const knownSlug =
            currentFolderId && foldersData ? findFolderSlugById(foldersData.data || [], currentFolderId) : null;
        const currentFolderParam = currentFolderId
            ? currentFolder && currentFolder.id === currentFolderId && currentFolder.slug
                ? currentFolder.slug
                : knownSlug
                ? knownSlug
                : currentFolderId.toString()
            : null;
        const params = new URLSearchParams();
        if (page > 1) params.set('page', page.toString());
        if (currentFolderParam) params.set('folder', currentFolderParam);
        const queryString = params.toString();
        window.history.replaceState(null, document.title, `/${queryString ? `?${queryString}` : ''}`);
    }, [page, currentFolderId, currentFolder, foldersData, findFolderSlugById]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    const navigateToFolder = (folderId: number | null) => {
        setCurrentFolderId(folderId);
        setPage(1);
    };

    const serverIdsInFolders = foldersData?.server_ids_in_folders || [];

    const serverMap = new Map<number, Server>();
    servers?.items.forEach((server) => {
        serverMap.set(Number(server.internalId), server);
    });

    const allVisibleServers = (() => {
        if (currentFolderId) {
            const folderServers = (currentFolder?.servers || [])
                .map((s) => serverMap.get(s.id))
                .filter((server): server is Server => server !== undefined);
            if (debouncedSearch) {
                return folderServers.filter((s) => serverMatchesSearch(s, debouncedSearch));
            }
            return folderServers;
        }
        const rootServers =
            servers?.items.filter((server) => !serverIdsInFolders.includes(Number(server.internalId))) || [];
        if (debouncedSearch) {
            return rootServers.filter((s) => serverMatchesSearch(s, debouncedSearch));
        }
        return rootServers;
    })();

    const currentOrderFolderKey = getServerOrderFolderKey(currentFolderId);
    const orderedVisibleServers = applyServerOrder(
        allVisibleServers,
        (serverOrderByFolder || {})[currentOrderFolderKey]
    );

    const totalPages = Math.ceil(orderedVisibleServers.length / FOLDER_PAGE_SIZE);

    useEffect(() => {
        if (totalPages > 0 && page > totalPages) {
            setPage(1);
        }
    }, [totalPages, page]);

    const visibleServers = orderedVisibleServers.slice((page - 1) * FOLDER_PAGE_SIZE, page * FOLDER_PAGE_SIZE);

    const foldersToDisplay = (() => {
        const baseFolders = currentFolderId ? currentFolder?.children || [] : foldersData?.data || [];
        if (!debouncedSearch) return baseFolders;
        return baseFolders.filter((folder) => folderMatchesSearch(folder, debouncedSearch));
    })();
    const currentFolderOrderParentKey = getFolderOrderParentKey(currentFolderId);
    const orderedFoldersToDisplay = applyFolderOrder(
        foldersToDisplay,
        (folderOrderByParent || {})[currentFolderOrderParentKey]
    );

    const scopedServerIds = new Set<number>((servers?.items || []).map((server) => Number(server.internalId)));

    const getScopedFolderServerCount = useCallback(
        (folder: ServerFolder): number => {
            const currentFolderCount = folder.servers.reduce(
                (count, server) => count + (scopedServerIds.has(server.id) ? 1 : 0),
                0
            );
            return (
                currentFolderCount +
                folder.children.reduce((count, child) => count + getScopedFolderServerCount(child), 0)
            );
        },
        [scopedServerIds]
    );

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            setActiveId(String(event.active.id));
            const item = parseDragId(String(event.active.id));
            if (!item) {
                return;
            }

            if (item.type === 'server') {
                setDraggedItem({
                    ...item,
                    sourceFolderId: currentFolderId,
                });
                return;
            }

            const folder = orderedFoldersToDisplay.find((folder) => folder.id === item.id);
            setDraggedItem({
                ...item,
                parentId: folder?.parent_id ?? currentFolderId,
            });
        },
        [currentFolderId, orderedFoldersToDisplay]
    );

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const activeItem = parseDragId(String(event.active.id));
            const overId = event.over ? String(event.over.id) : null;

            if (!activeItem || !overId) {
                setDraggedItem(null);
                setActiveId(null);
                return;
            }

            const folderDropId = parseFolderDropId(overId);

            try {
                if (activeItem.type === 'server') {
                    const sourceFolderId =
                        draggedItem?.type === 'server' ? draggedItem.sourceFolderId : currentFolderId;

                    if (folderDropId !== undefined) {
                        if (folderDropId === null) {
                            if (sourceFolderId !== null) {
                                await removeServerFromFolder(sourceFolderId, activeItem.id);
                                refreshAll();
                            }

                            setDraggedItem(null);
                            setActiveId(null);
                            return;
                        }

                        if (sourceFolderId !== folderDropId) {
                            await addServerToFolder(folderDropId, activeItem.id);
                            refreshAll();
                        }

                        setDraggedItem(null);
                        setActiveId(null);
                        return;
                    }

                    if (overId.startsWith('server:') && sourceFolderId === currentFolderId) {
                        const activeIndex = orderedVisibleServers.findIndex(
                            (server) => getServerDragId(Number(server.internalId)) === String(event.active.id)
                        );
                        const overIndex = orderedVisibleServers.findIndex(
                            (server) => getServerDragId(Number(server.internalId)) === overId
                        );

                        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                            const reorderedServers = arrayMove(orderedVisibleServers, activeIndex, overIndex);
                            setServerOrderByFolder((previous) => ({
                                ...(previous || {}),
                                [currentOrderFolderKey]: reorderedServers.map((server) => Number(server.internalId)),
                            }));
                        }
                    }

                    setDraggedItem(null);
                    return;
                }

                if (folderDropId !== undefined) {
                    const parentId = draggedItem?.type === 'folder' ? draggedItem.parentId : currentFolderId;

                    if (parentId !== folderDropId && activeItem.id !== folderDropId) {
                        await updateFolder(activeItem.id, { parent_id: folderDropId });
                        refreshAll();
                    }

                    setDraggedItem(null);
                    return;
                }

                if (!debouncedSearch && overId.startsWith('folder:')) {
                    const activeIndex = orderedFoldersToDisplay.findIndex(
                        (folder) => getFolderDragId(folder.id) === String(event.active.id)
                    );
                    const overIndex = orderedFoldersToDisplay.findIndex(
                        (folder) => getFolderDragId(folder.id) === overId
                    );

                    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                        const reorderedFolders = arrayMove(orderedFoldersToDisplay, activeIndex, overIndex);
                        setFolderOrderByParent((previous) => ({
                            ...(previous || {}),
                            [currentFolderOrderParentKey]: reorderedFolders.map((folder) => folder.id),
                        }));
                    }
                }
            } catch (error) {
                console.error('Failed to update drag item:', error);
            }

            setDraggedItem(null);
            setActiveId(null);
        },
        [
            currentFolderId,
            currentOrderFolderKey,
            currentFolderOrderParentKey,
            debouncedSearch,
            draggedItem,
            orderedFoldersToDisplay,
            orderedVisibleServers,
            refreshAll,
            setFolderOrderByParent,
            setServerOrderByFolder,
        ]
    );

    const handleDragCancel = useCallback(() => {
        setDraggedItem(null);
        setActiveId(null);
    }, []);

    const noop = () => {};

    return (
        <PageContentBlock title={t('title')} showFlashKey={'dashboard'}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <PageHeader
                    title={t('title')}
                    description={t('subtitle')}
                    meta={
                        servers && (
                            <>
                                <MetaChip icon={faServer}>
                                    {t('usage_servers', { count: servers.items.length })}
                                </MetaChip>
                                {orderedFoldersToDisplay.length > 0 && (
                                    <MetaChip icon={faFolder}>
                                        {t('usage_folders', { count: orderedFoldersToDisplay.length })}
                                    </MetaChip>
                                )}
                            </>
                        )
                    }
                    actions={
                        rootAdmin && (
                            <TogglePanel>
                                <ToggleText
                                    style={{ color: showOnlyAdmin ? 'var(--color-base)' : 'var(--color-muted)' }}
                                >
                                    {showOnlyAdmin ? t('showing_others_servers') : t('showing_your_servers')}
                                </ToggleText>
                                <Switch
                                    name={'show_all_servers'}
                                    defaultChecked={showOnlyAdmin}
                                    onChange={() => setShowOnlyAdmin((s) => !s)}
                                />
                            </TogglePanel>
                        )
                    }
                />

                <SearchContainer>
                    <SearchIconWrapper>
                        <FontAwesomeIcon icon={faSearch} />
                    </SearchIconWrapper>
                    <SearchInput
                        type='text'
                        placeholder={t('search_servers', 'Search servers...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <SearchClearButton
                            onClick={() => {
                                setSearchQuery('');
                                setDebouncedSearch('');
                            }}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </SearchClearButton>
                    )}
                </SearchContainer>

                {(currentFolderId || folderPath.length > 0) && (
                    <BreadcrumbNav>
                        <DroppableBreadcrumbButton
                            id={getFolderDropId(null)}
                            onClick={() => navigateToFolder(null)}
                            active={Boolean(draggedItem)}
                        >
                            <FontAwesomeIcon icon={faHome} />
                            {t('home')}
                        </DroppableBreadcrumbButton>
                        {folderPath.map((folder, index) => (
                            <React.Fragment key={folder.id}>
                                <span style={{ color: 'var(--color-muted)' }}>/</span>
                                <DroppableBreadcrumbButton
                                    id={getFolderDropId(folder.id)}
                                    onClick={() => navigateToFolder(folder.id)}
                                    active={index === folderPath.length - 1 || Boolean(draggedItem)}
                                    activeColor={folder.color}
                                >
                                    {folder.name}
                                </DroppableBreadcrumbButton>
                            </React.Fragment>
                        ))}
                    </BreadcrumbNav>
                )}

                {!servers || !foldersData ? (
                    <Spinner centered size={'large'} />
                ) : (
                    <>
                        {orderedFoldersToDisplay.length > 0 && (
                            <SortableContext
                                items={orderedFoldersToDisplay.map((folder) => getFolderDragId(folder.id))}
                                strategy={rectSortingStrategy}
                            >
                                <div className='grid gap-2 mb-4'>
                                    {orderedFoldersToDisplay.map((folder) => (
                                        <SortableDashboardItem
                                            key={folder.id}
                                            id={getFolderDragId(folder.id)}
                                            disabled={Boolean(debouncedSearch)}
                                        >
                                            <FolderCard
                                                folder={folder}
                                                serverCount={getScopedFolderServerCount(folder)}
                                                onClick={() => navigateToFolder(folder.id)}
                                                onUpdate={refreshAll}
                                                isServerDropActive={draggedItem?.type === 'server'}
                                                isDragging={
                                                    draggedItem?.type === 'folder' && draggedItem.id === folder.id
                                                }
                                                droppableId={getFolderDropId(folder.id)}
                                            />
                                        </SortableDashboardItem>
                                    ))}
                                </div>
                            </SortableContext>
                        )}

                        {!debouncedSearch && (
                            <div className='mb-4'>
                                <CreateFolderButton parentId={currentFolderId} onCreated={refreshAll} />
                            </div>
                        )}

                        {visibleServers.length > 0 ? (
                            <SortableContext
                                items={visibleServers.map((server) => getServerDragId(Number(server.internalId)))}
                                strategy={rectSortingStrategy}
                            >
                                <div
                                    className={`grid gap-2 ${
                                        serverListLayout === 'grid3'
                                            ? 'lg:grid-cols-3 md:grid-cols-2 grid-cols-1'
                                            : serverListLayout === 'grid2'
                                            ? 'lg:grid-cols-2 grid-cols-1'
                                            : 'grid-cols-1'
                                    }`}
                                >
                                    {visibleServers.map((server) => (
                                        <SortableDashboardItem
                                            key={server.uuid}
                                            id={getServerDragId(Number(server.internalId))}
                                        >
                                            <ServerRow
                                                server={server}
                                                layout={serverListLayout}
                                                onMove={() =>
                                                    setMoveModalServer({
                                                        id: Number(server.internalId),
                                                        name: server.name,
                                                    })
                                                }
                                                isDragging={
                                                    draggedItem?.type === 'server' &&
                                                    draggedItem.id === Number(server.internalId)
                                                }
                                            />
                                        </SortableDashboardItem>
                                    ))}
                                </div>
                            </SortableContext>
                        ) : (
                            orderedFoldersToDisplay.length === 0 && (
                                <p css={tw`text-center text-sm py-8`} style={{ color: 'var(--color-inverted)' }}>
                                    {debouncedSearch
                                        ? t('no_search_results', 'No servers found matching "{{query}}"').replace(
                                              '{{query}}',
                                              debouncedSearch
                                          )
                                        : showOnlyAdmin
                                        ? t('no_other_servers')
                                        : currentFolderId
                                        ? t('folder_empty')
                                        : t('no_servers')}
                                </p>
                            )
                        )}

                        {totalPages > 1 && (
                            <div className='mt-4'>
                                <Pagination
                                    data={{
                                        items: visibleServers,
                                        pagination: {
                                            total: orderedVisibleServers.length,
                                            count: visibleServers.length,
                                            perPage: FOLDER_PAGE_SIZE,
                                            currentPage: page,
                                            totalPages,
                                        },
                                    }}
                                    onPageSelect={setPage}
                                >
                                    {() => null}
                                </Pagination>
                            </div>
                        )}
                    </>
                )}

                <MoveServerModal
                    serverId={moveModalServer?.id || 0}
                    serverName={moveModalServer?.name || ''}
                    currentFolderId={currentFolderId}
                    isOpen={moveModalServer !== null}
                    onClose={() => setMoveModalServer(null)}
                    onMoved={refreshAll}
                />

                <DragOverlay dropAnimation={null}>
                    {activeId && activeId.startsWith('server:')
                        ? (() => {
                              const serverId = Number(activeId.replace('server:', ''));
                              const server = orderedVisibleServers.find((s) => Number(s.internalId) === serverId);
                              return server ? (
                                  <div style={{ cursor: 'grabbing' }}>
                                      <ServerRow server={server} layout={serverListLayout} isDragging={true} />
                                  </div>
                              ) : null;
                          })()
                        : activeId && activeId.startsWith('folder:')
                        ? (() => {
                              const folderId = Number(activeId.replace('folder:', ''));
                              const folder = orderedFoldersToDisplay.find((f) => f.id === folderId);
                              return folder ? (
                                  <div style={{ cursor: 'grabbing' }}>
                                      <FolderCard
                                          folder={folder}
                                          serverCount={getScopedFolderServerCount(folder)}
                                          onClick={noop}
                                          onUpdate={noop}
                                          isDragging={true}
                                      />
                                  </div>
                              ) : null;
                          })()
                        : null}
                </DragOverlay>
            </DndContext>
        </PageContentBlock>
    );
};
