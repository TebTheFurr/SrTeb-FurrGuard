export type PluginPlatform = 'modrinth' | 'curseforge' | 'hangar' | 'spigot';

export type PluginLoader =
    | 'bukkit'
    | 'bungeecord'
    | 'folia'
    | 'paper'
    | 'purpur'
    | 'spigot'
    | 'sponge'
    | 'velocity'
    | 'waterfall'
    | 'fabric';

export interface Plugin {
    id: string;
    platform: PluginPlatform;
    name: string;
    description: string;
    author: string;
    iconUrl?: string;
    externalUrl: string;
    downloads: number;
    lastUpdated?: string;
}

export interface PluginVersion {
    id: string;
    name: string;
    gameVersions: string[];
    downloadUrl: string;
    fileName: string;
    releaseDate?: string;
    downloads?: number;
}

export interface PluginSearchParams {
    query?: string;
    platforms: PluginPlatform[];
    gameVersion?: string;
    loader?: PluginLoader;
    page?: number;
    pageSize?: number;
}

export interface PluginSearchResult {
    plugins: Plugin[];
    totalCount: number;
    page: number;
    pageSize: number;
}


export const PLUGIN_LOADERS: { value: PluginLoader; label: string }[] = [
    { value: 'bukkit', label: 'Bukkit' },
    { value: 'bungeecord', label: 'BungeeCord' },
    { value: 'folia', label: 'Folia' },
    { value: 'paper', label: 'Paper' },
    { value: 'purpur', label: 'Purpur' },
    { value: 'spigot', label: 'Spigot' },
    { value: 'sponge', label: 'Sponge' },
    { value: 'velocity', label: 'Velocity' },
    { value: 'waterfall', label: 'Waterfall' },
    { value: 'fabric', label: 'Fabric' },
];

export const PLUGIN_PLATFORMS: { value: PluginPlatform; label: string }[] = [
    { value: 'modrinth', label: 'Modrinth' },
    { value: 'curseforge', label: 'CurseForge' },
    { value: 'hangar', label: 'Hangar' },
    { value: 'spigot', label: 'Spigot' },
];
