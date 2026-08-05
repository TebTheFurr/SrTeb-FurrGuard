import http from '@/api/http';
import loadDirectory from '@/api/server/files/loadDirectory';

const TRASH_FOLDER = '/.trash';
const TRASH_META_SEPARATOR = ':';
const TRASH_PATH_MAP_KEY = 'trash_original_paths';

const encodeTrashPath = (path: string): string => encodeURIComponent(path || '/');

const decodeTrashPath = (path: string): string => {
    try {
        return decodeURIComponent(path);
    } catch {
        return '/';
    }
};

const normalizeDirectory = (path: string): string => {
    const normalised = (path || '/').replace(/\/+/g, '/').replace(/\/+$/, '');
    return normalised || '/';
};

const toRenamePath = (path: string): string => path.replace(/\/+/g, '/').replace(/^\/+/, '');

const loadTrashPathMap = (): Record<string, string> => {
    try {
        const stored = localStorage.getItem(TRASH_PATH_MAP_KEY);
        if (!stored) {
            return {};
        }

        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, string>;
        }
    } catch {
    }

    return {};
};

const saveTrashPathMap = (map: Record<string, string>): void => {
    try {
        localStorage.setItem(TRASH_PATH_MAP_KEY, JSON.stringify(map));
    } catch {
    }
};

const setTrashOriginalPath = (trashFileName: string, originalDirectory: string): void => {
    const map = loadTrashPathMap();
    map[trashFileName] = normalizeDirectory(originalDirectory);
    saveTrashPathMap(map);
};

const getTrashOriginalPath = (trashFileName: string): string | undefined => {
    const map = loadTrashPathMap();
    return map[trashFileName];
};

const deleteTrashOriginalPaths = (trashFileNames: string[]): void => {
    if (!trashFileNames.length) {
        return;
    }

    const map = loadTrashPathMap();
    let changed = false;

    trashFileNames.forEach((fileName) => {
        if (map[fileName] !== undefined) {
            delete map[fileName];
            changed = true;
        }
    });

    if (changed) {
        saveTrashPathMap(map);
    }
};

const getTrashMetadata = (fileName: string): { originalName: string; originalPath?: string; deletedAtMs?: number } => {
    const separatorIndex = fileName.indexOf(TRASH_META_SEPARATOR);
    if (separatorIndex > 0) {
        const timestamp = fileName.slice(0, separatorIndex);
        if (/^\d+$/.test(timestamp)) {
            const rest = fileName.slice(separatorIndex + 1);
            const secondSeparatorIndex = rest.indexOf(TRASH_META_SEPARATOR);
            if (secondSeparatorIndex > 0) {
                const encodedPath = rest.slice(0, secondSeparatorIndex);
                const originalName = rest.slice(secondSeparatorIndex + 1);
                return {
                    originalName,
                    originalPath: normalizeDirectory(decodeTrashPath(encodedPath)),
                    deletedAtMs: Number(timestamp),
                };
            }
        }
    }

    const legacyMatch = fileName.match(/^(\d+)__([^_].*?)__(.+)$/);
    if (legacyMatch) {
        const [, timestamp, encodedPath, originalName] = legacyMatch;
        return {
            originalName,
            originalPath: normalizeDirectory(decodeTrashPath(encodedPath)),
            deletedAtMs: Number(timestamp),
        };
    }

    return {
        originalName: fileName.replace(/^\d+_/, ''),
    };
};

export const getTrashItemDisplayName = (fileName: string): string => getTrashMetadata(fileName).originalName;

export const moveToTrash = async (uuid: string, directory: string, files: string[], autoDeleteHours?: number): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/files/create-folder`, {
        root: '/',
        name: '.trash',
    }).catch(() => {});

    const encodedDirectory = encodeTrashPath(normalizeDirectory(directory));
    const renameData = files.map((file) => ({
        from: toRenamePath(`${directory}/${file}`),
        to: toRenamePath(`${TRASH_FOLDER}/${Date.now()}${TRASH_META_SEPARATOR}${encodedDirectory}${TRASH_META_SEPARATOR}${file}`),
    }));

    await http.put(`/api/client/servers/${uuid}/files/rename`, {
        root: '/',
        files: renameData,
    });

    const normalisedDirectory = normalizeDirectory(directory);
    renameData.forEach((item) => {
        const trashFileName = item.to.slice(`${TRASH_FOLDER}/`.length);
        setTrashOriginalPath(trashFileName, normalisedDirectory);
    });

    const parsedAutoDeleteHours = Number(autoDeleteHours);
    if (Number.isFinite(parsedAutoDeleteHours) && parsedAutoDeleteHours > 0) {
        try {
            const trashItems = await loadDirectory(uuid, TRASH_FOLDER);
            await purgeExpiredTrash(uuid, trashItems.map((item) => item.name), parsedAutoDeleteHours);
        } catch {
        }
    }
};

export const restoreFromTrash = async (uuid: string, fileName: string, originalPath?: string): Promise<void> => {
    const metadata = getTrashMetadata(fileName);
    const actualName = metadata.originalName;
    const mappedOriginalPath = getTrashOriginalPath(fileName);
    const restoreDirectory = normalizeDirectory(originalPath || mappedOriginalPath || metadata.originalPath || '/');
    const destination = toRenamePath(`${restoreDirectory}/${actualName}`);
    
    await http.put(`/api/client/servers/${uuid}/files/rename`, {
        root: '/',
        files: [{
            from: toRenamePath(`${TRASH_FOLDER}/${fileName}`),
            to: destination,
        }],
    });

    deleteTrashOriginalPaths([fileName]);
};

export const emptyTrash = async (uuid: string, files: string[]): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/files/delete`, {
        root: TRASH_FOLDER,
        files,
    });

    deleteTrashOriginalPaths(files);
};

export const purgeExpiredTrash = async (uuid: string, files: string[], autoDeleteHours: number): Promise<string[]> => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    if (!Number.isFinite(autoDeleteHours) || autoDeleteHours <= 0) {
        return [];
    }

    const expiryThreshold = Date.now() - (autoDeleteHours * 60 * 60 * 1000);
    const expiredFiles = files.filter((fileName) => {
        const deletedAtMs = getTrashMetadata(fileName).deletedAtMs;
        return typeof deletedAtMs === 'number' && Number.isFinite(deletedAtMs) && deletedAtMs <= expiryThreshold;
    });

    if (expiredFiles.length === 0) {
        return [];
    }

    await emptyTrash(uuid, expiredFiles);
    return expiredFiles;
};

export const getTrashPath = () => TRASH_FOLDER;
