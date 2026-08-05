import { useState, useEffect, useRef, useCallback } from 'react';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';

export interface SearchResult {
    file: FileObject;
    path: string;
    directory: string;
}

export type FileSearchMode = 'global' | 'current_directory';

export default function useGlobalFileSearch(
    uuid: string,
    query: string,
    ignoredFolders: string[] = [],
    searchMode: FileSearchMode = 'global',
    currentDirectory: string = '/'
) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [progress, setProgress] = useState({ scanned: 0, found: 0 });
    const abortRef = useRef(false);
    const cacheRef = useRef<Map<string, FileObject[]>>(new Map());
    const ignoredKey = ignoredFolders.join('\n');

    const clearCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            setSearching(false);
            setProgress({ scanned: 0, found: 0 });
            return;
        }

        abortRef.current = false;
        setSearching(true);
        setResults([]);
        setProgress({ scanned: 0, found: 0 });

        const lowerQuery = query.toLowerCase();
        const ignoredSet = new Set(
            ignoredKey ? ignoredKey.split('\n').map(f => f.toLowerCase()) : []
        );
        const allResults: SearchResult[] = [];
        let scannedDirs = 0;

        const loadDir = async (dirPath: string): Promise<FileObject[]> => {
            const cached = cacheRef.current.get(dirPath);
            if (cached) return cached;

            const files = await loadDirectory(uuid, dirPath);
            cacheRef.current.set(dirPath, files);
            return files;
        };

        const collectMatches = (dirPath: string, files: FileObject[]) => {
            const newMatches: SearchResult[] = [];

            for (const file of files) {
                if (file.name === '.trash') continue;
                if (!file.isFile && ignoredSet.has(file.name.toLowerCase())) continue;

                const fullPath = dirPath === '/'
                    ? '/' + file.name
                    : dirPath + '/' + file.name;

                if (file.name.toLowerCase().includes(lowerQuery)) {
                    newMatches.push({
                        file,
                        path: fullPath,
                        directory: dirPath,
                    });
                }
            }

            return newMatches;
        };

        const searchCurrentDirectory = async (dirPath: string) => {
            try {
                const files = await loadDir(dirPath);
                if (abortRef.current) return;

                scannedDirs = 1;
                const newMatches = collectMatches(dirPath, files);

                if (newMatches.length > 0) {
                    allResults.push(...newMatches);
                    setResults([...allResults]);
                }

                setProgress({ scanned: scannedDirs, found: allResults.length });
            } catch {
            }
        };

        const searchDirectory = async (dirPath: string, depth: number) => {
            if (abortRef.current || depth > 12 || allResults.length >= 500) return;

            try {
                const files = await loadDir(dirPath);
                if (abortRef.current) return;

                scannedDirs++;
                const newMatches = collectMatches(dirPath, files);
                const subDirs: string[] = [];

                for (const file of files) {
                    if (file.name === '.trash') continue;
                    if (!file.isFile && ignoredSet.has(file.name.toLowerCase())) continue;

                    const fullPath = dirPath === '/'
                        ? '/' + file.name
                        : dirPath + '/' + file.name;

                    if (!file.isFile) {
                        subDirs.push(fullPath);
                    }
                }

                if (newMatches.length > 0) {
                    allResults.push(...newMatches);
                    setResults([...allResults]);
                }
                setProgress({ scanned: scannedDirs, found: allResults.length });

                const batchSize = 4;
                for (let i = 0; i < subDirs.length; i += batchSize) {
                    if (abortRef.current || allResults.length >= 500) return;
                    const batch = subDirs.slice(i, i + batchSize);
                    await Promise.all(batch.map(dir => searchDirectory(dir, depth + 1)));
                }
            } catch {
            }
        };

        const debounceTimeout = setTimeout(async () => {
            if (searchMode === 'current_directory') {
                await searchCurrentDirectory(currentDirectory);
            } else {
                await searchDirectory('/', 0);
            }

            if (!abortRef.current) {
                setSearching(false);
            }
        }, 350);

        return () => {
            abortRef.current = true;
            clearTimeout(debounceTimeout);
        };
    }, [uuid, query, ignoredKey, searchMode, currentDirectory]);

    return { results, searching, progress, clearCache };
}
