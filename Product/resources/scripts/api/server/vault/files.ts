import http from '@/api/http';
import { backgroundHttp, unwrap, vaultUrl } from '@/api/server/vault/client';
import { Carpeta, CarpetaCopias, Cursor, Listado } from '@/api/server/vault/types';

/**
 * Number of copies in Backups or M-Backups: `total` of a one-entry page of the
 * folder root. Background request, so refreshing the tab badges does not move
 * the global progress bar.
 */
export const countVaultCopies = async (uuid: string, carpeta: CarpetaCopias): Promise<number> => {
    const { data } = await backgroundHttp.get(vaultUrl(uuid, 'listar'), { params: { carpeta, ruta: '', limite: 1 } });
    const listado = unwrap<Listado>(data);
    const total = Number(listado.total);

    return Number.isFinite(total) ? total : listado.entradas.length;
};

export interface ListarParams {
    carpeta: Carpeta;
    /** Relative to the carpeta; empty string for its root. */
    ruta: string;
    cursor?: Cursor | null;
    limite?: number;
}

/** `GET /vault/listar` — one page of a folder. At the root of Backups / M-Backups each entry carries its `backup`. */
export const listVault = async (uuid: string, params: ListarParams): Promise<Listado> => {
    const { data } = await http.get(vaultUrl(uuid, 'listar'), {
        params: {
            carpeta: params.carpeta,
            ruta: params.ruta,
            cursor: params.cursor ?? undefined,
            limite: params.limite,
        },
    });

    return unwrap<Listado>(data);
};

/** `GET /vault/descargar` — a signed, short-lived URL for one file. */
export const getVaultDownloadUrl = async (uuid: string, carpeta: Carpeta, ruta: string): Promise<string> => {
    const { data } = await http.get(vaultUrl(uuid, 'descargar'), { params: { carpeta, ruta } });

    return unwrap<{ url: string }>(data).url;
};

export interface ZipParams {
    carpeta: Carpeta;
    /** Folder relative to the carpeta. */
    ruta: string;
    /** Names inside `ruta`; omit to zip the whole folder. */
    nombres?: string[];
}

/** `POST /vault/zip` — a signed, short-lived URL that streams a zip. */
export const getVaultZipUrl = async (uuid: string, params: ZipParams): Promise<string> => {
    const { data } = await http.post(vaultUrl(uuid, 'zip'), {
        carpeta: params.carpeta,
        ruta: params.ruta,
        nombres: params.nombres && params.nombres.length > 0 ? params.nombres : undefined,
    });

    return unwrap<{ url: string }>(data).url;
};
