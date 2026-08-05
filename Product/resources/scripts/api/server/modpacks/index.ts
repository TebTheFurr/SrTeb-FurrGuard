import http from '@/api/http';
import { Server } from '@/api/server/getServer';

export const MODPACK_LOADERS = [
    { value: 'forge', label: 'Forge' },
    { value: 'neoforge', label: 'NeoForge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'quilt', label: 'Quilt' },
];

export const MODPACK_PLATFORMS = [
    { value: 'modrinth', label: 'Modrinth' },
    { value: 'curseforge', label: 'CurseForge' },
];

export const MODPACK_METADATA_FILE = '/.luna-modpack-installer.json';

export const PROTECTED_FILES = [
    'server.properties',
    'whitelist.json',
    'ops.json',
    'banned-players.json',
    'banned-ips.json',
    'eula.txt',
];

export const PROTECTED_DIRS = [
    'world',
    'world_nether',
    'world_the_end',
];

export const MODPACK_DIRS = [
    'mods',
    'config',
    'kubejs',
    'defaultconfigs',
    'scripts',
    'packmenu',
    'patchouli_books',
    'resourcepacks',
    'shaderpacks',
    'openloader',
];

const LOADER_TOKENS = ['forge', 'neoforge', 'fabric', 'quilt'] as const;
const MINECRAFT_HINTS = [
    'minecraft',
    'forge',
    'fabric',
    'quilt',
    'neoforge',
    'paper',
    'spigot',
    'purpur',
    'bukkit',
    'sponge',
];

type LoaderToken = (typeof LOADER_TOKENS)[number];

export interface ModpackCompatibility {
    shouldShow: boolean;
    isMinecraft: boolean;
    isModded: boolean;
    loader: LoaderToken | null;
    loaderVersion: string | null;
    gameVersion: string | null;
    message: string | null;
}

export interface InstalledModpackMetadata {
    schemaVersion: number;
    installedAt: string;
    platform: string;
    modpackId: string;
    modpackName: string;
    externalUrl?: string | null;
    iconUrl?: string | null;
    versionId: string;
    versionName: string;
    fileName?: string | null;
    gameVersion?: string | null;
    loader?: string | null;
    loaderVersion?: string | null;
    isServerPack?: boolean;
    installMode?: string | null;
}

export async function getModpackInstallerStatus(uuid: string) {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/status`);
    return data;
}

export async function searchModpacks(
    uuid: string,
    params: any
): Promise<{ modpacks: any[]; totalCount: number; page: number; pageSize: number; error: string | null; }> {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/search`, {
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
        modpacks: data.modpacks,
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
        error: data.error || null,
    };
}

export async function getModpackVersions(uuid: string, platform: string, modpackId: string, gameVersion?: string, loader?: string) {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/versions`, {
        params: {
            platform,
            modpackId,
            gameVersion: gameVersion || undefined,
            loader: loader || undefined,
        },
    });

    return data.versions;
}

export { default as getModpackDownloadUrl } from './getModpackDownloadUrl';
export type { ModpackDownloadUrlResult } from './getModpackDownloadUrl';

export async function getModpackDetails(uuid: string, platform: string, modpackId: string) {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/details`, {
        params: { platform, modpackId },
    });

    return data.details;
}

export interface ModpackJavaCompatibility {
    has_egg: boolean;
    egg_name?: string;
    minimum_java: number;
    available_java: number[];
    selected_java: number | null;
    selected_image: string | null;
    sufficient: boolean;
}

export async function getModpackJavaCompatibility(uuid: string, targetEggId: number, mcVersion: string, loaderType?: string | null): Promise<ModpackJavaCompatibility> {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/java-compatibility`, {
        params: { target_egg_id: targetEggId, mc_version: mcVersion, loader_type: loaderType || undefined },
    });
    return data;
}

export async function switchModpackEgg(uuid: string, targetEggId: number, mcVersion?: string | null, loaderType?: string | null, loaderVersion?: string | null): Promise<{ success: boolean; message: string; new_egg_id: number; new_egg_name: string; }> {
    const { data } = await http.post(`/api/client/servers/${uuid}/modpacks/switch-egg`, {
        target_egg_id: targetEggId,
        mc_version: mcVersion || undefined,
        loader_type: loaderType || undefined,
        loader_version: loaderVersion || undefined,
    });

    return data;
}

export async function getMinecraftVersions(uuid: string) {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/minecraft-versions`);
    return data.versions || [];
}

export async function getLoaderInstallerUrl(
    uuid: string,
    loader: string,
    loaderVersion: string,
    mcVersion?: string
): Promise<{ url: string | null; filename: string | null }> {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/installer-url`, {
        params: { loader, loaderVersion, mcVersion: mcVersion || undefined },
    });
    return data;
}

export async function getLoaderServerJarUrl(
    uuid: string,
    loader: string,
    mcVersion: string,
    loaderVersion?: string
): Promise<{ url: string | null; filename: string | null }> {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/server-jar-url`, {
        params: { loader, mcVersion, loaderVersion: loaderVersion || undefined },
    });
    return data;
}

export async function installLoaderServerJar(
    uuid: string,
    loader: string,
    mcVersion: string,
    loaderVersion?: string
): Promise<{ success: boolean; error?: string }> {
    const { data } = await http.post(`/api/client/servers/${uuid}/modpacks/install-server-jar`, {
        loader,
        mcVersion,
        loaderVersion: loaderVersion || undefined,
    });
    return data;
}

export { default as fixModpackPermissions } from './fixModpackPermissions';

const normaliseLoader = (value?: string | null): LoaderToken | null => {
    const loader = (value || '').toLowerCase().replace(/[^a-z]/g, '');
    if (loader.includes('neoforge')) return 'neoforge';
    if (loader.includes('fabric')) return 'fabric';
    if (loader.includes('quilt')) return 'quilt';
    if (loader.includes('forge')) return 'forge';
    return null;
};

const extractVersion = (value?: string | null): string | null => {
    if (!value) return null;
    const match = value.match(/\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9._-]+)?/);
    return match?.[0] || null;
};

const collectServerText = (server?: Partial<Server> | null) => {
    if (!server) return '';
    const variableValues = (server.variables || []).reduce<string[]>((accumulator, variable) => {
        [
            variable.name,
            variable.description,
            variable.envVariable,
            variable.defaultValue,
            variable.serverValue,
        ].forEach((value) => {
            if (value) {
                accumulator.push(value);
            }
        });

        return accumulator;
    }, []);
    const values = [
        server.invocation,
        server.dockerImage,
        ...(server.eggFeatures || []),
        ...variableValues,
    ];
    return values.filter(Boolean).join(' ').toLowerCase();
};

const getVariableValue = (server: Partial<Server> | null | undefined, names: string[]) => {
    const variables = server?.variables || [];
    for (const variable of variables) {
        if (names.indexOf(variable.envVariable) !== -1) {
            return variable.serverValue || variable.defaultValue || null;
        }
    }
    return null;
};

export const getModpackCompatibility = (server?: Partial<Server> | null): ModpackCompatibility => {
    const text = collectServerText(server);
    const hasMinecraftHint = MINECRAFT_HINTS.some((hint) => text.includes(hint));
    const explicitLoader = [
        normaliseLoader(getVariableValue(server, ['NEOFORGE_VERSION', 'NEO_VERSION'])),
        normaliseLoader(getVariableValue(server, ['QUILT_LOADER_VERSION', 'QUILT_VERSION'])),
        normaliseLoader(getVariableValue(server, ['FABRIC_LOADER_VERSION', 'LOADER_VERSION', 'FABRIC_VERSION'])),
        normaliseLoader(getVariableValue(server, ['FORGE_VERSION', 'FORGEVERSION'])),
    ].find(Boolean) || null;

    const inferredLoader = explicitLoader || LOADER_TOKENS.find((loader) => text.includes(loader)) || null;
    const gameVersion = extractVersion(
        getVariableValue(server, ['MC_VERSION', 'MINECRAFT_VERSION', 'VERSION', 'GAME_VERSION', 'VANILLA_VERSION']) ||
        text
    );
    const loaderVersion = extractVersion(
        getVariableValue(server, [
            'FORGE_VERSION',
            'FORGEVERSION',
            'NEOFORGE_VERSION',
            'NEO_VERSION',
            'FABRIC_LOADER_VERSION',
            'LOADER_VERSION',
            'FABRIC_VERSION',
            'QUILT_LOADER_VERSION',
            'QUILT_VERSION',
        ])
    );

    if (!hasMinecraftHint) {
        return {
            shouldShow: false,
            isMinecraft: false,
            isModded: false,
            loader: null,
            loaderVersion,
            gameVersion,
            message: null,
        };
    }

    if (!inferredLoader) {
        return {
            shouldShow: true,
            isMinecraft: true,
            isModded: false,
            loader: null,
            loaderVersion,
            gameVersion,
            message: 'This server looks like Minecraft. If no loader is installed yet, the modpack installer can switch to a configured Forge, NeoForge, Fabric, or Quilt egg automatically.',
        };
    }

    return {
        shouldShow: true,
        isMinecraft: true,
        isModded: true,
        loader: inferredLoader,
        loaderVersion,
        gameVersion,
        message: null,
    };
};
