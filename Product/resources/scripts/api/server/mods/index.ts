import http from '@/api/http';

export const MOD_LOADERS = [
    { value: 'forge', label: 'Forge' },
    { value: 'neoforge', label: 'NeoForge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'quilt', label: 'Quilt' },
    { value: 'liteloader', label: 'LiteLoader' },
    { value: 'rift', label: 'Rift' },
    { value: 'modloader', label: "Risugami's ModLoader" },
];

export const CURSEFORGE_LOADERS = ['forge', 'neoforge', 'fabric', 'quilt'];

export const MOD_PLATFORMS = [
    { value: 'modrinth', label: 'Modrinth' },
    { value: 'curseforge', label: 'CurseForge' },
];

export type ModGame = 'minecraft' | 'hytale';

export async function getModInstallerStatus(uuid) {
    const { data } = await http.get(`/api/client/servers/${uuid}/mods/status`);
    return data;
}

export async function searchMods(uuid, params) {
    const { data } = await http.get(`/api/client/servers/${uuid}/mods/search`, {
        params: {
            game: params.game || 'minecraft',
            query: params.query || '',
            platforms: params.platforms,
            gameVersion: params.gameVersion || undefined,
            loader: params.loader || undefined,
            category: params.category || undefined,
            page: params.page || 1,
            pageSize: params.pageSize || 20,
        },
    });

    return {
        mods: data.mods,
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
    };
}

export async function getModVersions(uuid, platform, modId, gameVersion, loader, game: ModGame = 'minecraft') {
    const { data } = await http.get(`/api/client/servers/${uuid}/mods/versions`, {
        params: {
            game,
            platform,
            modId,
            gameVersion: gameVersion || undefined,
            loader: loader || undefined,
        },
    });

    return data.versions;
}

export async function getGameVersions(uuid, game: ModGame = 'minecraft') {
    const { data } = await http.get(`/api/client/servers/${uuid}/mods/game-versions`, {
        params: { game },
    });
    return data.versions || [];
}

export async function getMinecraftVersions(uuid) {
    return getGameVersions(uuid, 'minecraft');
}

export async function getModCategories(uuid, game: ModGame = 'hytale') {
    const { data } = await http.get(`/api/client/servers/${uuid}/mods/categories`, {
        params: { game },
    });
    return data.categories || [];
}
