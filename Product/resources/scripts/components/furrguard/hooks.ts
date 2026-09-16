import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { furr, FurrError, furrError, isAbortError } from '@/api/furrguard/client';
import { Pagination } from '@/api/furrguard/types';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { toNum } from '@/components/furrguard/lib/format';

/*
 * Data hooks of the FurrGuard page. Lists are paginated on the server and keep their
 * filters in the URL query, so going back to a section (or reloading) shows the same list.
 */

export type Filters = Record<string, string>;

export const PER_PAGE_OPTIONS = [25, 50, 100] as const;

export interface PagedListOptions<F extends Filters> {
    action: string;
    /** Default values. An empty value is not sent to the server. */
    filters: F;
    /** Accepted values per filter: anything else coming from the URL is ignored. */
    allowed?: { [K in keyof F]?: readonly string[] };
    /** Prefix of the query keys, for several lists inside one section. */
    prefix?: string;
    perPage?: number;
    /** Filters that wait until typing stops. By default only `search`. */
    debounced?: readonly (keyof F)[];
    /** Key the action used for the rows before `items` (§4.4). */
    legacyKey?: string;
}

export interface PagedList<T, F extends Filters = Filters> {
    items: T[];
    /** The whole `data` object of the last answer (stats, ip_hidden…). */
    data: Record<string, unknown>;
    pagination: Pagination;
    loading: boolean;
    error: FurrError | null;
    /** Filter values as shown in the controls (a search may be typed but not applied yet). */
    filters: F;
    setFilter: (key: keyof F & string, value: string) => void;
    page: number;
    perPage: number;
    setPage: (page: number) => void;
    setPerPage: (perPage: number) => void;
    reload: () => void;
}

interface ListState<F extends Filters> {
    filters: F;
    page: number;
    perPage: number;
}

const readPagination = (result: Record<string, unknown>, count: number, state: ListState<Filters>): Pagination => {
    const raw = result.pagination;
    if (typeof raw === 'object' && raw !== null) {
        const p = raw as Record<string, unknown>;

        return {
            page: toNum(p.page) || state.page,
            per_page: toNum(p.per_page) || state.perPage,
            total: toNum(p.total),
            total_pages: toNum(p.total_pages),
        };
    }

    return { page: 1, per_page: state.perPage, total: count, total_pages: count ? 1 : 0 };
};

const readItems = <T>(result: unknown, legacyKey?: string): T[] => {
    if (Array.isArray(result)) return result as T[];
    if (typeof result !== 'object' || result === null) return [];
    const data = result as Record<string, unknown>;
    if (Array.isArray(data.items)) return data.items as T[];
    const legacy = legacyKey ? data[legacyKey] : undefined;

    return Array.isArray(legacy) ? (legacy as T[]) : [];
};

export function usePagedList<T, F extends Filters>(options: PagedListOptions<F>): PagedList<T, F> {
    const location = useLocation();
    const history = useHistory();
    const { interceptError } = useFurrGuard();
    const prefix = options.prefix ?? '';
    const defaultPerPage = options.perPage ?? PER_PAGE_OPTIONS[0];
    // Options are static per mount: keep the first ones so the effects below never re-run for them.
    const optionsRef = useRef(options);
    const defaults = optionsRef.current.filters;
    const keys = useMemo(() => Object.keys(defaults) as (keyof F & string)[], [defaults]);
    const debounced = useMemo(() => new Set<keyof F>(optionsRef.current.debounced ?? ['search']), []);
    const queryKey = useCallback((key: string) => `${prefix}${key}`, [prefix]);

    // The URL is the source of truth of what is applied.
    const state = useMemo<ListState<F>>(() => {
        const query = new URLSearchParams(location.search);
        const next = { ...defaults };
        for (const key of keys) {
            const value = query.get(queryKey(key))?.trim().slice(0, 100);
            const allowed = optionsRef.current.allowed?.[key];
            if (value === undefined || value === null || (allowed && !allowed.includes(value))) continue;
            next[key] = value as F[typeof key];
        }
        const pageValue = Math.floor(Number(query.get(queryKey('page'))));
        const perPageValue = Number(query.get(queryKey('per_page')));

        return {
            filters: next,
            page: Number.isFinite(pageValue) && pageValue > 1 ? pageValue : 1,
            perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perPageValue) ? perPageValue : defaultPerPage,
        };
    }, [location.search, keys, queryKey, defaults, defaultPerPage]);
    const stateKey = JSON.stringify(state);

    const [draft, setDraft] = useState<F>(state.filters);
    const [items, setItems] = useState<T[]>([]);
    const [data, setData] = useState<Record<string, unknown>>({});
    const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: defaultPerPage, total: 0, total_pages: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FurrError | null>(null);
    const [version, setVersion] = useState(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedKey = useRef('');

    // Coming back to the section (or the top bar changing the query) resets what the controls show.
    useEffect(() => {
        setDraft(state.filters);
    }, [stateKey]);

    const commit = useCallback(
        (changes: Partial<Record<string, string | number>>) => {
            const query = new URLSearchParams(location.search);
            for (const [key, value] of Object.entries(changes)) {
                const name = queryKey(key);
                const isDefault =
                    key === 'page' ? Number(value) <= 1 : key === 'per_page' ? Number(value) === defaultPerPage : !value || value === defaults[key];
                if (isDefault) query.delete(name);
                else query.set(name, String(value));
            }
            const search = query.toString();
            const next = search ? `?${search}` : '';
            if (next !== location.search) history.replace({ pathname: location.pathname, search: next });
        },
        [location.search, location.pathname, history, queryKey, defaults, defaultPerPage]
    );

    const setFilter = useCallback(
        (key: keyof F & string, value: string) => {
            setDraft((current) => ({ ...current, [key]: value }));
            if (timer.current) clearTimeout(timer.current);
            const apply = () => commit({ [key]: value, page: 1 });
            if (debounced.has(key)) timer.current = setTimeout(apply, 350);
            else apply();
        },
        [commit, debounced]
    );

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );

    useEffect(() => {
        const controller = new AbortController();
        const params: Record<string, unknown> = { page: state.page, per_page: state.perPage };
        for (const key of keys) if (state.filters[key]) params[key] = state.filters[key];
        const key = JSON.stringify(params);
        setLoading(true);
        setError(null);

        furr<unknown>(optionsRef.current.action, params, controller.signal)
            .then((result) => {
                const list = readItems<T>(result, optionsRef.current.legacyKey);
                const object = typeof result === 'object' && result !== null && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
                setItems(list);
                setData(object);
                setPagination(readPagination(object, list.length, state));
                loadedKey.current = key;
                setLoading(false);
            })
            .catch((e) => {
                if (isAbortError(e)) return;
                setLoading(false);
                if (interceptError(e)) return;
                setError(furrError(e));
                // Rows of another search would be confusing: only keep them when the same list failed to refresh.
                if (loadedKey.current !== key) setItems([]);
            });

        return () => controller.abort();
    }, [stateKey, version]);

    return {
        items,
        data,
        pagination,
        loading,
        error,
        filters: draft,
        setFilter,
        page: state.page,
        perPage: state.perPage,
        setPage: (page: number) => commit({ page: Math.max(1, Math.floor(page)) }),
        setPerPage: (perPage: number) => commit({ per_page: perPage, page: 1 }),
        reload: () => setVersion((v) => v + 1),
    };
}

/**
 * Loads one record for a dialog: every load empties the previous record first, so a failure
 * never leaves another row's data on screen.
 */
export function useDetail<T>() {
    const { interceptError } = useFurrGuard();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const controller = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controller.current?.abort();
        controller.current = null;
        setLoading(false);
    }, []);

    const load = useCallback(
        (action: string, params: Record<string, unknown>) => {
            cancel();
            const current = new AbortController();
            controller.current = current;
            setData(null);
            setError('');
            setLoading(true);
            furr<T>(action, params, current.signal)
                .then((result) => {
                    if (controller.current === current) setData(result);
                })
                .catch((e) => {
                    if (controller.current !== current || isAbortError(e)) return;
                    if (!interceptError(e)) setError(furrError(e).message);
                })
                .then(() => {
                    if (controller.current === current) {
                        controller.current = null;
                        setLoading(false);
                    }
                });
        },
        [cancel, interceptError]
    );

    useEffect(() => cancel, [cancel]);

    return { data, loading, error, load, cancel };
}

/**
 * Runs a mutation marking which row is busy. The success message only shows once the server
 * answered well; on failure its message is shown and false is returned.
 */
export function useBusy() {
    const { notify, notifyError } = useFurrGuard();
    const [busy, setBusy] = useState<string | number | null>(null);

    const run = useCallback(
        async (key: string | number, action: () => Promise<unknown>, success?: string): Promise<boolean> => {
            setBusy(key);
            try {
                await action();
                if (success) notify(success, 'success');

                return true;
            } catch (error) {
                notifyError(error);

                return false;
            } finally {
                setBusy(null);
            }
        },
        [notify, notifyError]
    );

    return { busy, run };
}

export interface ConfirmRequest {
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
}

export interface PendingConfirm extends ConfirmRequest {
    resolve: (confirmed: boolean) => void;
}

/** One confirmation dialog per view, used as a promise instead of window.confirm. */
export function useConfirm() {
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    const confirm = useCallback(
        (request: ConfirmRequest): Promise<boolean> =>
            new Promise((resolve) => {
                setPending((current) => {
                    current?.resolve(false);

                    return { ...request, resolve };
                });
            }),
        []
    );

    const settle = useCallback((confirmed: boolean) => {
        setPending((current) => {
            current?.resolve(confirmed);

            return null;
        });
    }, []);

    return { confirm, pending, settle };
}

/**
 * Loads one resource on mount (and on demand): the pattern of the overview, the player
 * card, the messages and the settings.
 */
export function useLoader<T>(load: (signal: AbortSignal) => Promise<T>, deps: React.DependencyList = []) {
    const { interceptError } = useFurrGuard();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FurrError | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        load(controller.signal)
            .then((result) => {
                setData(result);
                setLoading(false);
            })
            .catch((e) => {
                if (isAbortError(e)) return;
                setLoading(false);
                if (interceptError(e)) return;
                setData(null);
                setError(furrError(e));
            });

        return () => controller.abort();
    }, [version, ...deps]);

    return { data, setData, loading, error, reload: () => setVersion((v) => v + 1) };
}
