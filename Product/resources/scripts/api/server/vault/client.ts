import axios, { AxiosError } from 'axios';
import http from '@/api/http';

/** Base URL of the Vault client API for a server (long uuid or identifier). */
export const vaultUrl = (uuid: string, suffix = ''): string =>
    `/api/client/servers/${uuid}/vault${suffix ? `/${suffix.replace(/^\/+/, '')}` : ''}`;

const isEnvelope = (value: unknown): value is { ok: true; data: unknown } =>
    typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === true && 'data' in value;

/**
 * The panel is specified to answer with the vault's `data` object as is. The
 * vault envelope (`{ok, data}`) is tolerated too so a proxy that forwards the
 * whole body does not break the page.
 */
export const unwrap = <T>(value: unknown): T => (isEnvelope(value) ? value.data : value) as T;

/**
 * Background polling (job progress, server lock) must not drive the global
 * progress bar that the shared `http` instance starts on every request, or it
 * would flash every two seconds. Same defaults, no interceptors.
 */
export const backgroundHttp = axios.create({
    withCredentials: true,
    timeout: http.defaults.timeout,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
    },
});

interface PterodactylErrorBody {
    errors?: Array<{ code?: string; status?: string; detail?: string }>;
}

const responseOf = (error: unknown): AxiosError<PterodactylErrorBody>['response'] | undefined =>
    axios.isAxiosError(error) ? (error as AxiosError<PterodactylErrorBody>).response : undefined;

/** Error code of a failed client API call: the vault code or the Pterodactyl exception name. */
export const vaultErrorCode = (error: unknown): string | null => responseOf(error)?.data?.errors?.[0]?.code ?? null;

export const vaultErrorStatus = (error: unknown): number | null => responseOf(error)?.status ?? null;

/** The vault session stored in the panel session expired or is missing: show the sign-in gate again. */
export const isVaultSessionError = (error: unknown): boolean =>
    vaultErrorStatus(error) === 401 && vaultErrorCode(error) === 'sesion_panel';

/**
 * Pterodactyl locks every server route while the server is restoring
 * (`restoring_backup`), which a Vault restore with `detener` sets.
 */
export const isServerLockedError = (error: unknown): boolean =>
    vaultErrorStatus(error) === 409 && vaultErrorCode(error) === 'ServerStateConflictException';
