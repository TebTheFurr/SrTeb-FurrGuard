import { useEffect, useState } from 'react';
import getDirectorySize from '@/api/server/files/getDirectorySize';

export type DirectorySizeState =
    | { status: 'loading' }
    | { status: 'resolved'; size: number }
    | { status: 'failed' };

export type DirectorySizeMap = Record<string, DirectorySizeState>;

/** Folders resolved at once. Keeps one slow folder from stalling the rest. */
const CONCURRENCY = 4;

/**
 * Ceiling on how many folders a single directory will look up. The client API
 * allows 256 requests per minute per user, so a directory holding hundreds of
 * folders would otherwise spend the whole budget on a single page load.
 */
const MAX_LOOKUPS = 100;

/** Mirrors the cache window the panel applies server-side. */
const CACHE_TTL = 60 * 1000;

const cache = new Map<string, { size: number; at: number }>();

const cacheKey = (uuid: string, path: string): string => `${uuid}:${path}`;

const joinPath = (directory: string, name: string): string =>
    directory === '/' ? `/${name}` : `${directory}/${name}`;

/**
 * Resolves the real size of every folder in the current directory, a few at a
 * time. Results are cached for as long as the panel caches them, so walking
 * back into a directory does not spend requests again.
 */
export default function useDirectorySizes(uuid: string, directory: string, names: string[]): DirectorySizeMap {
    const [sizes, setSizes] = useState<DirectorySizeMap>({});
    // `names` is a new array on every render, so depend on its contents instead.
    const namesKey = JSON.stringify(names);

    useEffect(() => {
        if (names.length === 0) {
            setSizes({});
            return;
        }

        const now = Date.now();
        const initial: DirectorySizeMap = {};
        const queue: string[] = [];

        for (const name of names.slice(0, MAX_LOOKUPS)) {
            const hit = cache.get(cacheKey(uuid, joinPath(directory, name)));

            if (hit && now - hit.at < CACHE_TTL) {
                initial[name] = { status: 'resolved', size: hit.size };
            } else {
                initial[name] = { status: 'loading' };
                queue.push(name);
            }
        }

        setSizes(initial);

        if (queue.length === 0) {
            return;
        }

        let aborted = false;

        const worker = async (): Promise<void> => {
            while (!aborted) {
                const name = queue.shift();
                if (name === undefined) {
                    return;
                }

                const path = joinPath(directory, name);

                try {
                    const size = await getDirectorySize(uuid, path);
                    cache.set(cacheKey(uuid, path), { size, at: Date.now() });

                    if (!aborted) {
                        setSizes((current) => ({ ...current, [name]: { status: 'resolved', size } }));
                    }
                } catch {
                    // A node running stock Wings, a folder deleted mid-flight or a
                    // restricted path all end up here. The cell falls back to a dash.
                    if (!aborted) {
                        setSizes((current) => ({ ...current, [name]: { status: 'failed' } }));
                    }
                }
            }
        };

        void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

        return () => {
            aborted = true;
        };
    }, [uuid, directory, namesKey]);

    return sizes;
}
