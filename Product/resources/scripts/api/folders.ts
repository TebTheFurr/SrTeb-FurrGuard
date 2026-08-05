import http from '@/api/http';

export interface ServerInFolder {
    id: number;
    uuid: string;
    name: string;
    sort_order: number;
}

export interface ServerFolder {
    id: number;
    parent_id: number | null;
    name: string;
    slug: string | null;
    color: string;
    sort_order: number;
    children: ServerFolder[];
    servers: ServerInFolder[];
    server_count: number;
    created_at: string;
    updated_at: string;
}

export interface FoldersResponse {
    data: ServerFolder[];
    server_ids_in_folders: number[];
}

export const getFolders = async (): Promise<FoldersResponse> => {
    const { data } = await http.get('/api/client/folders');
    return data;
};

export const getFolder = async (folderId: number): Promise<ServerFolder> => {
    const { data } = await http.get(`/api/client/folders/${folderId}`);
    return data.data;
};

export const createFolder = async (folder: { name: string; slug?: string | null; color: string; parent_id?: number | null }): Promise<ServerFolder> => {
    const { data } = await http.post('/api/client/folders', folder);
    return data.data;
};

export const updateFolder = async (folderId: number, updates: { name?: string; slug?: string | null; color?: string; parent_id?: number | null; sort_order?: number }): Promise<ServerFolder> => {
    const { data } = await http.put(`/api/client/folders/${folderId}`, updates);
    return data.data;
};

export const deleteFolder = async (folderId: number): Promise<void> => {
    await http.delete(`/api/client/folders/${folderId}`);
};

export const addServerToFolder = async (folderId: number, serverId: number): Promise<void> => {
    await http.post(`/api/client/folders/${folderId}/servers`, { server_id: serverId });
};

export const removeServerFromFolder = async (folderId: number, serverId: number): Promise<void> => {
    await http.delete(`/api/client/folders/${folderId}/servers/${serverId}`);
};


export const reorderFolders = async (folders: { id: number; sort_order: number }[]): Promise<void> => {
    await http.post('/api/client/folders/reorder', { folders });
};
