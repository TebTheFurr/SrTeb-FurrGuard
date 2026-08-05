import {
    MODPACK_DIRS,
    PROTECTED_DIRS,
    PROTECTED_FILES,
    installLoaderServerJar,
} from '@/api/server/modpacks';
import getModpackDownloadUrl from '@/api/server/modpacks/getModpackDownloadUrl';
import fixModpackPermissions from '@/api/server/modpacks/fixModpackPermissions';
import pullFile from '@/api/server/files/pullFile';
import createDirectory from '@/api/server/files/createDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import renameFiles from '@/api/server/files/renameFiles';
import loadDirectory from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import { httpErrorToHuman } from '@/api/http';

const MODPACK_ROOT_MARKERS = [
    'manifest.json',
    'modrinth.index.json',
    'mods',
    'config',
    'defaultconfigs',
    'kubejs',
    'scripts',
    'overrides',
    'server-overrides',
    'server_overrides',
];
const LOADER_RUNTIME_FILES = ['unix_args.txt'];
const LOADER_RUNTIME_DIRS = ['libraries'];
const OVERRIDE_DIRECTORIES = ['overrides', 'server-overrides', 'server_overrides', 'overrides-server'];
const SUPPORTED_LOADERS = ['forge', 'neoforge', 'fabric', 'quilt'];

export const normaliseLoader = (value?: string | null) => {
    const loader = (value || '').toLowerCase().replace(/[^a-z]/g, '');

    if (loader.includes('neoforge')) return 'neoforge';
    if (loader.includes('fabric')) return 'fabric';
    if (loader.includes('quilt')) return 'quilt';
    if (loader.includes('forge')) return 'forge';

    return null;
};

const extractVersionToken = (value?: string | null) => {
    if (!value) return null;

    const match = value.match(/\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9._-]+)?/);

    return match?.[0] || null;
};

export const getLoaderFromVersion = (version) => {
    const loaders = Array.isArray(version?.loaders) ? version.loaders : [];
    const preferredOrder = ['neoforge', 'forge', 'fabric', 'quilt'];

    for (const preferredLoader of preferredOrder) {
        for (const loaderEntry of loaders) {
            const loaderEntryText = typeof loaderEntry === 'string' ? loaderEntry : '';
            const loader = normaliseLoader(loaderEntryText);
            if (loader === preferredLoader) {
                return {
                    type: loader,
                    version: extractVersionToken(loaderEntryText),
                };
            }
        }
    }

    return {
        type: null,
        version: null,
    };
};

const isLegacyForgeVersion = (mcVersion?: string | null) => {
    if (!mcVersion) {
        return false;
    }

    const match = mcVersion.match(/^(\d+)\.(\d+)/);
    if (!match) {
        return false;
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);

    return major < 1 || (major === 1 && minor < 17);
};

const hasServerJarEntry = (entries: Array<{ isFile: boolean; name: string }>) => {
    return entries.some((entry) => entry.isFile && entry.name.toLowerCase() === 'server.jar');
};

const rankJarCandidate = (filename: string, legacyForge: boolean, loaderType?: string | null) => {
    const name = filename.toLowerCase();

    if (loaderType === 'fabric' || loaderType === 'quilt') {
        if (name.indexOf('fabric-server-launch') !== -1) return 100;
        if (name.indexOf('fabric-server') !== -1) return 95;
        if (loaderType === 'quilt' && name.indexOf('quilt') !== -1 && name.indexOf('server') !== -1) return 95;
        if (name.indexOf('fabric') !== -1 || name.indexOf('quilt') !== -1) return 85;
        if (name.indexOf('minecraft') !== -1 && name.indexOf('server') !== -1) return 75;
        return 10;
    }

    if (legacyForge && name.indexOf('universal') !== -1) return 100;
    if (legacyForge && name.indexOf('shim') !== -1) return 90;
    if (name.indexOf('neoforge') !== -1) return 80;
    if (name.indexOf('forge') !== -1) return 70;
    if (name.indexOf('minecraft') !== -1 && name.indexOf('server') !== -1) return 60;

    return 10;
};

const pickJarCandidate = (
    entries: Array<{ isFile: boolean; name: string }>,
    loaderType: string,
    mcVersion?: string | null
) => {
    const legacyForge = loaderType === 'forge' && isLegacyForgeVersion(mcVersion);
    const jarCandidates = entries.filter((entry) => {
        if (!entry.isFile) return false;

        const name = entry.name.toLowerCase();
        if (!name.endsWith('.jar')) return false;
        if (name.indexOf('installer') !== -1 || name.indexOf('client') !== -1) return false;

        return legacyForge || name.indexOf('universal') === -1;
    });

    jarCandidates.sort((a, b) => rankJarCandidate(b.name, legacyForge, loaderType) - rankJarCandidate(a.name, legacyForge, loaderType));

    return jarCandidates[0] || null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ignoreFailure = async (action: () => Promise<any>) => {
    try {
        await action();
    } catch (error) {
    }
};

export const ensureWritablePermissions = async (uuid: string): Promise<void> => {
    await ignoreFailure(() => fixModpackPermissions(uuid));
};

export const ensureEulaAccepted = async (uuid: string): Promise<void> => {
    await ignoreFailure(() => saveFileContents(uuid, 'eula.txt', 'eula=true\n'));
};

export const cleanupServerFiles = async (uuid: string, selectedOption: string) => {
    const fileNames = (await loadDirectory(uuid, '/')).map((entry) => entry.name);

    if (selectedOption === 'full_wipe') {
        const toDelete = fileNames.filter((name) => name !== '.' && name !== '..');
        if (toDelete.length > 0) await deleteFiles(uuid, '/', toDelete);
        return;
    }

    if (selectedOption === 'smart_replace') {
        const protectedSet = new Set([...PROTECTED_FILES, ...PROTECTED_DIRS]);
        const toDelete = fileNames.filter((name) => name !== '.' && name !== '..' && !protectedSet.has(name));
        if (toDelete.length > 0) await deleteFiles(uuid, '/', toDelete);
        return;
    }

    if (selectedOption === 'mods_only') {
        const toDelete = fileNames.filter((name) => MODPACK_DIRS.indexOf(name.toLowerCase()) !== -1);
        if (toDelete.length > 0) await deleteFiles(uuid, '/', toDelete);
    }
};

export const resolveArchiveDownload = async (uuid: string, modpack: any, selectedVersion: any) => {
    const archiveName = `luna-modpack-${modpack.platform}-${selectedVersion.id}.zip`.replace(/[^a-zA-Z0-9._-]/g, '-');
    let downloadUrl = selectedVersion.downloadUrl;
    let useDownloadHeader = modpack.platform === 'curseforge';

    try {
        const resolvedDownload = await getModpackDownloadUrl(uuid, modpack.platform, modpack.id, selectedVersion.id);
        if (resolvedDownload.downloadUrl) {
            downloadUrl = resolvedDownload.downloadUrl;
            useDownloadHeader = resolvedDownload.useHeader;
        } else if (!downloadUrl) {
            throw new Error(resolvedDownload.error || 'This modpack version does not provide a downloadable server archive.');
        }
    } catch (error) {
        if (!downloadUrl) {
            throw buildInstallStepError('Failed to resolve a download URL for this modpack version.', error);
        }
    }

    if (!downloadUrl) {
        throw new Error('This modpack version does not provide a downloadable server archive.');
    }

    return { archiveName, downloadUrl, useDownloadHeader };
};

export const downloadArchive = async (uuid: string, archiveName: string, downloadUrl: string, useDownloadHeader: boolean) => {
    await pullFile(uuid, {
        url: downloadUrl,
        directory: '/',
        filename: archiveName,
        useHeader: useDownloadHeader,
        foreground: true,
    });
};

const rootContainsModpackMarker = (names: string[]) => {
    return names.some((name) => MODPACK_ROOT_MARKERS.indexOf(name.toLowerCase()) !== -1);
};

const moveDirectoryContentsToRoot = async (uuid: string, directory: string) => {
    const entries = await loadDirectory(uuid, `/${directory}`);

    for (const entry of entries) {
        await ignoreFailure(() => renameFiles(uuid, `/${directory}`, [{ from: entry.name, to: `../${entry.name}` }]));
    }

    await ignoreFailure(() => deleteFiles(uuid, '/', [directory]));
};

export const applyExtractedModpackLayout = async (uuid: string) => {
    let rootEntries = await loadDirectory(uuid, '/');
    let dirNames = rootEntries.filter((entry) => entry.isFile === false).map((entry) => entry.name);

    if (!rootContainsModpackMarker(rootEntries.map((entry) => entry.name))) {
        for (const dirName of dirNames) {
            try {
                const nestedEntries = await loadDirectory(uuid, `/${dirName}`);
                if (!rootContainsModpackMarker(nestedEntries.map((entry) => entry.name))) continue;

                await moveDirectoryContentsToRoot(uuid, dirName);
                rootEntries = await loadDirectory(uuid, '/');
                dirNames = rootEntries.filter((entry) => entry.isFile === false).map((entry) => entry.name);
                break;
            } catch (error) {
            }
        }
    }

    const dirSet = new Set(dirNames);
    for (const overrideDir of OVERRIDE_DIRECTORIES) {
        if (dirSet.has(overrideDir)) {
            await moveDirectoryContentsToRoot(uuid, overrideDir);
        }
    }
};

const ensureServerJarFromCandidates = async (
    uuid: string,
    loaderType: string,
    mcVersion?: string | null
) => {
    const rootEntries = await loadDirectory(uuid, '/');

    if (hasServerJarEntry(rootEntries)) {
        return true;
    }

    const jarCandidate = pickJarCandidate(rootEntries, loaderType, mcVersion);
    if (!jarCandidate) {
        return false;
    }

    await renameFiles(uuid, '/', [{ from: jarCandidate.name, to: 'server.jar' }]);

    return true;
};

export const waitForServerJar = async (
    uuid: string,
    loaderType: string | null,
    mcVersion: string | null,
    timeoutMs = 10 * 60 * 1000
) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (loaderType && (await ensureServerJarFromCandidates(uuid, loaderType, mcVersion))) {
            return;
        }

        await sleep(5000);
    }

    throw new Error('Timed out waiting for server.jar to be generated. Check the console for egg installation progress.');
};

interface ModrinthIndexFile {
    path: string;
    downloads?: string[];
    fileSize?: number;
    env?: {
        client?: string;
        server?: string;
    };
}

const isSafeModrinthPath = (filePath: string) => {
    const normalised = filePath.replace(/\\/g, '/');

    if (normalised.startsWith('/') || /^[a-zA-Z]:/.test(normalised)) return false;
    if (normalised.split('/').some((part) => part === '..')) return false;

    return normalised.length > 0;
};

const shouldInstallModrinthIndexFile = (file: ModrinthIndexFile) => {
    const serverEnv = (file.env?.server || 'required').toLowerCase();

    return serverEnv !== 'unsupported';
};

const splitModrinthFilePath = (filePath: string) => {
    const normalised = filePath.replace(/\\/g, '/');
    const lastSlash = normalised.lastIndexOf('/');

    if (lastSlash === -1) {
        return { directory: '/', filename: normalised };
    }

    return {
        directory: `/${normalised.substring(0, lastSlash)}`,
        filename: normalised.substring(lastSlash + 1),
    };
};

const ensureDirectoryPath = async (uuid: string, directoryPath: string, createdDirs: Set<string>) => {
    if (directoryPath === '/' || directoryPath === '') {
        return;
    }

    const parts = directoryPath.replace(/^\//, '').split('/').filter(Boolean);
    let current = '/';

    for (const part of parts) {
        const fullPath = current === '/' ? `/${part}` : `${current}/${part}`;
        if (createdDirs.has(fullPath)) {
            current = fullPath;
            continue;
        }

        await ignoreFailure(() => createDirectory(uuid, current, part));
        createdDirs.add(fullPath);
        current = fullPath;
    }
};

const fileAlreadyInstalled = async (
    uuid: string,
    directory: string,
    filename: string,
    expectedSize?: number
) => {
    try {
        const entries = await loadDirectory(uuid, directory);
        const existing = entries.find((entry) => entry.isFile && entry.name === filename);

        if (!existing) return false;
        if (expectedSize && expectedSize > 0) return existing.size === expectedSize;

        return existing.size > 0;
    } catch (error) {
        return false;
    }
};

const installModrinthIndexFiles = async (uuid: string) => {
    const raw = await getFileContents(uuid, '/modrinth.index.json');
    const index = JSON.parse(raw);
    const indexFiles: ModrinthIndexFile[] = Array.isArray(index.files) ? index.files : [];
    const filesToInstall = indexFiles.filter((file) => {
        return !!file.path
            && isSafeModrinthPath(file.path)
            && shouldInstallModrinthIndexFile(file)
            && Array.isArray(file.downloads)
            && file.downloads.length > 0;
    });

    if (filesToInstall.length === 0) {
        return;
    }

    const createdDirs = new Set<string>();
    const uniqueDirectories = Array.from(new Set(filesToInstall.map((file) => splitModrinthFilePath(file.path).directory)));
    for (const directory of uniqueDirectories) {
        await ensureDirectoryPath(uuid, directory, createdDirs);
    }

    const pendingFiles = [...filesToInstall];
    const workerCount = 3;
    const installSingleFile = async (file: ModrinthIndexFile) => {
        const downloadUrls = (file.downloads || []).filter(Boolean);
        const { directory, filename } = splitModrinthFilePath(file.path);

        if (downloadUrls.length === 0 || await fileAlreadyInstalled(uuid, directory, filename, file.fileSize)) {
            return;
        }

        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const downloadUrl = downloadUrls[attempt % downloadUrls.length];

            try {
                await pullFile(uuid, { url: downloadUrl, directory, filename, foreground: true });
                if (await fileAlreadyInstalled(uuid, directory, filename, file.fileSize)) {
                    return;
                }

                lastError = new Error('File did not appear after download.');
            } catch (error) {
                lastError = error;
            }

            await sleep(1500);
        }

        const detail = lastError ? httpErrorToHuman(lastError) : '';
        throw new Error(`Failed to download ${file.path} from Modrinth.${detail ? ` ${detail}` : ''}`);
    };

    const workers = Array.from({ length: workerCount }, async () => {
        while (pendingFiles.length > 0) {
            const file = pendingFiles.shift();
            if (file) await installSingleFile(file);
        }
    });

    await Promise.all(workers);
};

export const installModrinthIndexIfPresent = async (uuid: string, platform: string) => {
    if (platform !== 'modrinth') {
        return;
    }

    const rootNames = (await loadDirectory(uuid, '/')).map((entry) => entry.name.toLowerCase());
    if (rootNames.indexOf('modrinth.index.json') !== -1) {
        await installModrinthIndexFiles(uuid);
        await ensureWritablePermissions(uuid);
    }
};

const detectLoaderFromDependencyMap = (deps: Record<string, string>) => {
    const loaderPriority = ['neoforge', 'forge', 'fabric', 'quilt'];

    for (const preferred of loaderPriority) {
        for (const key of Object.keys(deps)) {
            if (key === 'minecraft') continue;

            const normalised = normaliseLoader(key.replace(/-?loader$/, ''));
            if (normalised === preferred) {
                return { type: normalised, version: deps[key] };
            }
        }
    }

    return { type: null, version: null };
};

export const resolveInstalledLoader = async (
    uuid: string,
    platform: string,
    selectedVersion: any,
    versionLoader: { type: string | null; version: string | null },
    requestedLoader: string | null,
    requestedGameVersion: string | null
) => {
    let resolvedLoaderType: string | null = versionLoader.type || requestedLoader || null;
    let resolvedLoaderVersion: string | null = versionLoader.version || null;
    let resolvedMcVersion: string | null = selectedVersion.gameVersions?.[0] ?? requestedGameVersion ?? null;

    if (platform === 'curseforge') {
        try {
            const raw = await withTimeout(getFileContents(uuid, '/manifest.json'), 15000, 'Timed out while reading manifest.json.');
            const manifest = JSON.parse(raw);
            resolvedMcVersion = manifest?.minecraft?.version || resolvedMcVersion;
            const modLoaders: Array<{ id: string; primary: boolean }> = manifest?.minecraft?.modLoaders || [];
            const primary = modLoaders.find((loader) => loader.primary) || modLoaders[0];

            if (primary?.id) {
                const idx = primary.id.indexOf('-');
                const manifestLoader = idx !== -1 ? normaliseLoader(primary.id.substring(0, idx)) : null;
                if (manifestLoader) {
                    resolvedLoaderType = manifestLoader;
                    resolvedLoaderVersion = primary.id.substring(idx + 1);
                }
            }
        } catch (error) {
        }
    } else if (platform === 'modrinth') {
        try {
            const raw = await withTimeout(getFileContents(uuid, '/modrinth.index.json'), 15000, 'Timed out while reading modrinth.index.json.');
            const manifest = JSON.parse(raw);
            const deps: Record<string, string> = manifest?.dependencies || {};
            const detectedLoader = detectLoaderFromDependencyMap(deps);

            resolvedMcVersion = deps.minecraft || resolvedMcVersion;
            if (detectedLoader.type) {
                resolvedLoaderType = detectedLoader.type;
                resolvedLoaderVersion = detectedLoader.version;
            }
        } catch (error) {
        }
    }

    return {
        type: resolvedLoaderType,
        version: resolvedLoaderVersion,
        mcVersion: resolvedMcVersion,
    };
};

const clearLoaderRuntime = async (uuid: string) => {
    await ignoreFailure(() => deleteFiles(uuid, '/', LOADER_RUNTIME_FILES));
    await ignoreFailure(() => deleteFiles(uuid, '/', LOADER_RUNTIME_DIRS));
};

const prepareForgeRuntime = async (uuid: string, loaderType: string, mcVersion: string | null) => {
    const loaderRoot = await loadDirectory(uuid, '/');
    const hasServerJar = hasServerJarEntry(loaderRoot);
    const legacyForge = loaderType === 'forge' && isLegacyForgeVersion(mcVersion);

    if (legacyForge) {
        return !hasServerJar;
    }

    const hasUnixArgs = loaderRoot.some((entry) => entry.isFile && entry.name.toLowerCase() === 'unix_args.txt');
    const hasLibraries = loaderRoot.some((entry) => !entry.isFile && entry.name.toLowerCase() === 'libraries');
    const missingRuntime = !hasUnixArgs || !hasLibraries || !hasServerJar;

    if (!missingRuntime || !hasUnixArgs) {
        return missingRuntime;
    }

    try {
        const unixArgs = (await getFileContents(uuid, '/unix_args.txt')).toLowerCase();
        if (loaderType === 'forge' && unixArgs.indexOf('neoforged') !== -1) return true;
        if (loaderType === 'neoforge' && unixArgs.indexOf('minecraftforge') !== -1 && unixArgs.indexOf('neoforged') === -1) return true;
    } catch (error) {
        return true;
    }

    return missingRuntime;
};

const prepareFabricRuntime = async (
    uuid: string,
    loaderType: string,
    mcVersion: string | null,
    loaderVersion: string | null
) => {
    let hasServerJar = false;

    try {
        hasServerJar = hasServerJarEntry(await loadDirectory(uuid, '/'));
    } catch (error) {
        hasServerJar = false;
    }

    if (!hasServerJar && mcVersion) {
        await ignoreFailure(async () => {
            const result = await installLoaderServerJar(uuid, loaderType, mcVersion, loaderVersion || undefined);
            if (result.success) {
                await ignoreFailure(() => deleteFiles(uuid, '/', ['fabric-installer.jar', 'fabric-server-launch.jar']));
                hasServerJar = true;
            }
        });
    }

    return !hasServerJar;
};

export const prepareLoaderRuntime = async (
    uuid: string,
    loaderType: string | null,
    mcVersion: string | null,
    loaderVersion: string | null
) => {
    if (!loaderType || SUPPORTED_LOADERS.indexOf(loaderType) === -1) {
        return false;
    }

    await ensureServerJarFromCandidates(uuid, loaderType, mcVersion);

    if (loaderType === 'forge' || loaderType === 'neoforge') {
        try {
            const needsBootstrap = await prepareForgeRuntime(uuid, loaderType, mcVersion);
            if (needsBootstrap) await clearLoaderRuntime(uuid);

            return needsBootstrap;
        } catch (error) {
            await clearLoaderRuntime(uuid);
            return true;
        }
    }

    if (loaderType === 'fabric' || loaderType === 'quilt') {
        return prepareFabricRuntime(uuid, loaderType, mcVersion, loaderVersion);
    }

    return false;
};

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

export function buildInstallStepError(message: string, error: any): Error {
    const detail = httpErrorToHuman(error);

    if (!detail || detail === 'An unexpected error was encountered while processing this request, please try again.') {
        return new Error(message);
    }

    return new Error(`${message} ${detail}`);
}
