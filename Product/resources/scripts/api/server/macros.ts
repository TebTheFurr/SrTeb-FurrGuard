import http from '@/api/http';

export interface MacroArgument {
    name: string;
}

export interface ServerMacro {
    id: number;
    shortcut: string;
    output: string;
    arguments: MacroArgument[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateMacroData {
    shortcut: string;
    output: string;
    arguments?: MacroArgument[];
}

export interface UpdateMacroData {
    shortcut: string;
    output: string;
    arguments?: MacroArgument[];
}

const transformMacro = (data: any): ServerMacro => ({
    id: data.id,
    shortcut: data.shortcut,
    output: data.output,
    arguments: data.arguments || [],
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
});

export const getMacros = async (uuid: string): Promise<ServerMacro[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/macros`);
    return data.data.map(transformMacro);
};

export const createMacro = async (uuid: string, macroData: CreateMacroData): Promise<ServerMacro> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/macros`, macroData);
    return transformMacro(data.data);
};

export const updateMacro = async (uuid: string, macroId: number, macroData: UpdateMacroData): Promise<ServerMacro> => {
    const { data } = await http.put(`/api/client/servers/${uuid}/macros/${macroId}`, macroData);
    return transformMacro(data.data);
};

export const deleteMacro = async (uuid: string, macroId: number): Promise<void> => {
    await http.delete(`/api/client/servers/${uuid}/macros/${macroId}`);
};
