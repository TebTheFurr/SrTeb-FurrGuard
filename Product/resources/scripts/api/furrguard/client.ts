import axios, { AxiosError } from 'axios';
import http from '@/api/http';
import { FurrSession } from '@/api/furrguard/types';

/*
 * Client of the FurrGuard page (`/api/client/furrguard/...`). The panel proxies every
 * action to FurrGuard with the Discord session it keeps server-side, so the browser
 * never sees a FurrGuard token: it only ever talks to the panel.
 */

export const FURRGUARD_URL = '/api/client/furrguard';

/** Codes FurrGuard answers with 401 when the stored session is gone (docs/API.md §4.2). */
const SESSION_CODES = ['unauthorized', 'session_expired', 'access_revoked'];

const FALLBACK_MESSAGES: Record<number, string> = {
    400: 'La petición no es válida.',
    401: 'Tu sesión de FurrGuard ha caducado. Vuelve a entrar con Discord.',
    403: 'No tienes permiso para hacer esto.',
    404: 'No se ha encontrado lo que buscabas.',
    409: 'Ya existe un registro igual.',
    422: 'Hay datos que no son válidos.',
    429: 'Demasiadas peticiones.',
    500: 'Error interno de FurrGuard.',
    502: 'FurrGuard devolvió una respuesta inesperada.',
    503: 'FurrGuard no está disponible ahora mismo.',
};

interface PterodactylErrorBody {
    errors?: Array<{ code?: string; status?: string; detail?: string; meta?: { field?: string; retry_after?: number } }>;
}

/** A failed call, with the FurrGuard code and message when the panel relayed them. */
export class FurrError extends Error {
    readonly status: number;
    readonly code: string;
    readonly field: string | null;
    readonly retryAfter: number | null;

    constructor(status: number, code: string, message: string, field: string | null = null, retryAfter: number | null = null) {
        super(message);
        this.name = 'FurrError';
        this.status = status;
        this.code = code;
        this.field = field;
        this.retryAfter = retryAfter;
    }
}

export const isAbortError = (error: unknown): boolean =>
    axios.isCancel(error) || (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError');

/** Any thrown value as a FurrError, so views can branch on `status` / `code` and show `message`. */
export const furrError = (error: unknown): FurrError => {
    if (error instanceof FurrError) return error;

    const response = axios.isAxiosError(error) ? (error as AxiosError<PterodactylErrorBody>).response : undefined;
    if (!response) {
        return new FurrError(0, 'network', 'No se pudo conectar con el panel. Revisa tu conexión.');
    }

    const first = response.data?.errors?.[0];
    const status = response.status;
    const code = first?.code || (status === 401 ? 'unauthorized' : 'error');
    const detail = first?.detail && first.detail.trim() ? first.detail.trim() : null;
    const retryAfter = first?.meta?.retry_after ?? null;

    if (status === 429) {
        const message = retryAfter
            ? `Demasiadas peticiones: espera ${retryAfter} s y vuelve a intentarlo.`
            : detail ?? 'Demasiadas peticiones: espera un momento y vuelve a intentarlo.';

        return new FurrError(status, code, message, null, retryAfter);
    }

    return new FurrError(status, code, detail ?? FALLBACK_MESSAGES[status] ?? 'No se pudo completar la operación.', first?.meta?.field ?? null);
};

/** The stored FurrGuard session expired, was revoked or never existed: show the sign-in gate again. */
export const isFurrSessionError = (error: unknown): boolean => {
    const parsed = furrError(error);

    return parsed.status === 401 && SESSION_CODES.includes(parsed.code);
};

export interface FurrState {
    session: FurrSession | null;
}

/** `GET /furrguard` — `{session: null}` before signing in with Discord, otherwise the identity and permissions. */
export const getFurrGuardState = async (): Promise<FurrState> => {
    const { data } = await http.get(FURRGUARD_URL);

    return { session: data?.session ?? null };
};

/** `POST /furrguard/logout` — closes the Discord session of FurrGuard (the panel session is untouched). */
export const logoutFurrGuard = async (): Promise<void> => {
    await http.post(`${FURRGUARD_URL}/logout`);
};

/**
 * Runs one FurrGuard panel action (FurrGuard docs/API.md §4.4) and returns its `data`.
 * Errors are rethrown as FurrError.
 */
export async function furr<T>(action: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    try {
        const { data } = await http.post(`${FURRGUARD_URL}/action`, { action, params }, { signal });

        return (data?.data ?? null) as T;
    } catch (error) {
        if (isAbortError(error)) throw error;

        throw furrError(error);
    }
}
