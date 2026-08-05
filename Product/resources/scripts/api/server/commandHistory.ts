import http from '@/api/http';

export interface CommandHistoryItem {
    id: number;
    command: string;
    createdAt: Date;
}

export const getCommandHistory = async (uuid: string): Promise<CommandHistoryItem[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/command-history`);
    
    return data.data.map((item: any) => ({
        id: item.id,
        command: item.command,
        createdAt: new Date(item.created_at),
    }));
};

export const storeCommandHistory = async (uuid: string, command: string): Promise<CommandHistoryItem> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/command-history`, { command });
    
    return {
        id: data.data.id,
        command: data.data.command,
        createdAt: new Date(data.data.created_at),
    };
};

export const deleteCommandHistory = async (uuid: string, historyId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/command-history/${historyId}`);
};

export const clearCommandHistory = async (uuid: string): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/command-history/clear`);
};
