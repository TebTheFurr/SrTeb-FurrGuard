import http from '@/api/http';
import { Server } from '@/api/server/getServer';

export const MINECRAFT_VERSION_MANAGER_SMART_CLEANUP = [
    'libraries',
    'cache',
    'logs',
    'versions',
    'mods',
    'config',
    'plugins',
    'world',
    'world_nether',
    'world_the_end',
    'server.jar',
    'paper.jar',
    'purpur.jar',
    'velocity.jar',
    'waterfall.jar',
    'BungeeCord.jar',
];

const MINECRAFT_HINTS = [
    'minecraft',
    'paper',
    'purpur',
    'spigot',
    'folia',
    'forge',
    'neoforge',
    'fabric',
    'quilt',
];

const PROXY_HINTS = [
    'velocity',
    'waterfall',
    'bungeecord',
];

export interface MinecraftVersionFork {
    id: string;
    name: string;
    description: string;
    iconUrl?: string | null;
    category: 'server' | 'modded' | 'proxy';
    supportsBuilds: boolean;
    supportsExperimental: boolean;
    requiresMinecraftVersion: boolean;
    targetEggId?: number | null;
}

export interface MinecraftVersionSummary {
    id: string;
    name: string;
    type: string;
    stable: boolean;
    experimental: boolean;
    releaseDate: string | null;
    javaVersion: number | null;
    buildCount?: number | null;
}

export const getMinecraftVersionInfoUrl = (fork: string, versionId: string): string | null => {
    switch (fork) {
        case 'vanilla':
            return `https://minecraft.wiki/w/Java_Edition_${encodeURIComponent(versionId)}`;
        case 'paper':
            return `https://papermc.io/downloads/paper`;
        case 'folia':
            return `https://papermc.io/downloads/folia`;
        case 'velocity':
            return `https://papermc.io/downloads/velocity`;
        case 'waterfall':
            return `https://papermc.io/downloads/waterfall`;
        case 'purpur':
            return `https://purpurmc.org/downloads`;
        case 'spigot':
            return `https://getbukkit.org/download/spigot`;
        case 'forge':
            return `https://files.minecraftforge.net/net/minecraftforge/forge/index_${encodeURIComponent(versionId)}.html`;
        case 'neoforge':
            return `https://projects.neoforged.net/neoforged/neoforge`;
        case 'fabric':
            return `https://fabricmc.net/use/installer/`;
        case 'quilt':
            return `https://quiltmc.org/en/install/`;
        case 'bungeecord':
            return `https://www.spigotmc.org/wiki/bungeecord/`;
        default:
            return null;
    }
};

export interface MinecraftBuildSummary {
    id: string;
    name: string;
    type: string;
    stable: boolean;
    experimental: boolean;
    releaseDate: string | null;
    javaVersion: number | null;
    downloadUrl?: string | null;
    downloadName?: string | null;
    notes?: string | null;
}

export interface MinecraftVersionCompatibility {
    shouldShow: boolean;
    isMinecraft: boolean;
    isProxy: boolean;
    fork: string | null;
    minecraftVersion: string | null;
    message: string | null;
}

export interface MinecraftDetectedState extends MinecraftVersionCompatibility {
    buildId?: string | null;
    javaVersion?: number | null;
    targetEggId?: number | null;
}

export interface MinecraftVersionStatus {
    installed: boolean;
    enabled: boolean;
    detected: MinecraftDetectedState;
}

const collectServerText = (server?: Partial<Server> | null) => {
    if (!server) {
        return '';
    }

    const variableValues = (server.variables || []).reduce<string[]>((values, variable) => {
        [
            variable.name,
            variable.description,
            variable.envVariable,
            variable.defaultValue,
            variable.serverValue,
        ].forEach((value) => {
            if (value) {
                values.push(value);
            }
        });

        return values;
    }, []);

    return [
        server.invocation,
        server.dockerImage,
        ...(server.eggFeatures || []),
        ...variableValues,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
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

const extractVersion = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }

    const match = value.match(/\d+\.\d+(?:\.\d+)?/);

    return match?.[0] || null;
};

const detectFork = (text: string): string | null => {
    if (text.includes('purpur')) return 'purpur';
    if (text.includes('paper')) return 'paper';
    if (text.includes('folia')) return 'folia';
    if (text.includes('velocity')) return 'velocity';
    if (text.includes('waterfall')) return 'waterfall';
    if (text.includes('bungeecord')) return 'bungeecord';
    if (text.includes('spigot')) return 'spigot';
    if (text.includes('neoforge')) return 'neoforge';
    if (text.includes('forge')) return 'forge';
    if (text.includes('quilt')) return 'quilt';
    if (text.includes('fabric')) return 'fabric';
    if (text.includes('minecraft')) return 'vanilla';

    return null;
};

export const getMinecraftVersionCompatibility = (server?: Partial<Server> | null): MinecraftVersionCompatibility => {
    const text = collectServerText(server);
    const isMinecraft = MINECRAFT_HINTS.some((hint) => text.includes(hint));
    const isProxy = PROXY_HINTS.some((hint) => text.includes(hint));
    const minecraftVersion = extractVersion(
        getVariableValue(server, ['MC_VERSION', 'MINECRAFT_VERSION', 'VERSION', 'GAME_VERSION', 'VANILLA_VERSION']) || text
    );

    if (isMinecraft || isProxy) {
        return {
            shouldShow: true,
            isMinecraft,
            isProxy,
            fork: detectFork(text),
            minecraftVersion,
            message: null,
        };
    }

    return {
        shouldShow: false,
        isMinecraft: false,
        isProxy: false,
        fork: detectFork(text),
        minecraftVersion,
        message: 'This server does not look like a supported Minecraft or proxy egg.',
    };
};

export async function getMinecraftVersionManagerStatus(uuid: string): Promise<MinecraftVersionStatus> {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft-versions/status`);
    return data;
}

export async function getMinecraftVersionForks(uuid: string): Promise<MinecraftVersionFork[]> {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft-versions/forks`);
    return data.forks || [];
}

export async function getMinecraftVersionVersions(uuid: string, fork: string): Promise<MinecraftVersionSummary[]> {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft-versions/versions`, {
        params: { fork },
    });

    return data.versions || [];
}

export async function getMinecraftVersionBuilds(
    uuid: string,
    fork: string,
    minecraftVersion?: string | null
): Promise<MinecraftBuildSummary[]> {
    const { data } = await http.get(`/api/client/servers/${uuid}/minecraft-versions/builds`, {
        params: {
            fork,
            minecraftVersion: minecraftVersion || undefined,
        },
    });

    return data.builds || [];
}

export async function switchMinecraftVersion(
    uuid: string,
    payload: {
        fork: string;
        minecraftVersion?: string | null;
        versionName?: string | null;
        buildId?: string | null;
        buildName?: string | null;
        downloadName?: string | null;
        buildType?: string | null;
        javaVersion?: number | null;
        targetEggId?: number | null;
        cleanupMode?: 'none' | 'smart' | 'full';
        writeEula?: boolean;
    }
): Promise<{ success: boolean; detected: MinecraftDetectedState; selection: { fork: string; minecraftVersion?: string | null; versionName?: string | null; buildId?: string | null; buildName?: string | null; downloadName?: string | null; buildType?: string | null; javaVersion?: number | null; targetEggId?: number | null } }> {
    const { data } = await http.post(`/api/client/servers/${uuid}/minecraft-versions/switch`, payload);
    return data;
}
