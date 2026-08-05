import http from '@/api/http';

export interface ServerSplitUsage {
    used: {
        memory: number;
        cpu: number;
        disk: number;
        allocations: number;
        databases: number;
        backups: number;
        count: number;
    };
    parent: {
        memory: number;
        cpu: number;
        disk: number;
        allocations: number;
        databases: number;
        backups: number;
        assigned_allocations: number;
    };
    available: {
        memory: number | null;
        cpu: number | null;
        disk: number | null;
        allocations: number;
        databases: number;
        backups: number;
    };
}

export interface ServerSplit {
    id: number;
    server_id: number;
    identifier: string;
    uuid: string;
    name: string;
    description: string;
    status: string | null;
    memory: number;
    cpu: number;
    disk: number;
    allocations: number;
    databases: number;
    backups: number;
    node: string | null;
    address: string | null;
    created_at: string | null;
}

export interface ServerSplitEgg {
    id: number;
    name: string;
    nest_id: number;
    nest_name: string;
}

export interface ServerSplitStatus {
    enabled: boolean;
    message?: string;
    users_may_delete?: boolean;
    users_may_recreate?: boolean;
    limits?: {
        max_splits: number;
        max_memory: number;
        max_cpu: number;
        max_disk: number;
        max_allocations: number;
        max_databases: number;
        max_backups: number;
    };
    server_split_limit?: number | null;
    parent_egg_id?: number;
    split_eggs?: ServerSplitEgg[];
}

export interface ServerSplitsResponse {
    status: ServerSplitStatus;
    usage: ServerSplitUsage | null;
    splits: ServerSplit[];
}

export interface CreateServerSplitPayload {
    name: string;
    description?: string;
    egg_id: number;
    memory: number;
    cpu: number;
    disk: number;
    allocations: number;
    database_limit: number;
    backup_limit: number;
}

export const getServerSplits = async (uuid: string): Promise<ServerSplitsResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/splits`);

    return data;
};

export const createServerSplit = async (uuid: string, payload: CreateServerSplitPayload): Promise<ServerSplitsResponse> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/splits`, payload);

    return data;
};

export const deleteServerSplit = async (uuid: string, splitServerId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/splits/${splitServerId}`);
};
