import http from '@/api/http';
import {
    Plugin,
    PluginVersion,
    PluginPlatform,
    PluginLoader,
    PluginSearchParams,
    PluginSearchResult,
} from './types';

export * from './types';

export interface PluginInstallerStatus {
    installed: boolean;
}

export async function getPluginInstallerStatus(uuid: string): Promise<PluginInstallerStatus> {
    const { data } = await http.get(`/api/client/servers/${uuid}/plugins/status`);
    return data as PluginInstallerStatus;
}

export async function searchPlugins(uuid: string, params: PluginSearchParams): Promise<PluginSearchResult> {
    const { data } = await http.get(`/api/client/servers/${uuid}/plugins/search`, {
        params: {
            query: params.query || '',
            platforms: params.platforms,
            gameVersion: params.gameVersion || undefined,
            loader: params.loader || undefined,
            page: params.page || 1,
            pageSize: params.pageSize || 20,
        },
    });

    return {
        plugins: data.plugins as Plugin[],
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
    };
}

export async function getPluginVersions(
    uuid: string,
    platform: PluginPlatform,
    pluginId: string,
    gameVersion?: string,
    loader?: PluginLoader
): Promise<PluginVersion[]> {
    const { data } = await http.get(`/api/client/servers/${uuid}/plugins/versions`, {
        params: {
            platform,
            pluginId,
            gameVersion: gameVersion || undefined,
            loader: loader || undefined,
        },
    });

    return data.versions as PluginVersion[];
}

export async function getMinecraftVersions(uuid: string): Promise<string[]> {
    const { data } = await http.get(`/api/client/servers/${uuid}/plugins/minecraft-versions`);
    return data.versions || [];
}
