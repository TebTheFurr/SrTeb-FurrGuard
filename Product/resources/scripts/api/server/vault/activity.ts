import http from '@/api/http';
import { unwrap, vaultUrl } from '@/api/server/vault/client';
import { Cursor, PaginaActividad } from '@/api/server/vault/types';

export interface ActividadParams {
    cursor?: Cursor | null;
    limite?: number;
}

/** `GET /vault/actividad` — the vault audit trail for this server, newest first. */
export const getVaultActivity = async (uuid: string, params: ActividadParams = {}): Promise<PaginaActividad> => {
    const { data } = await http.get(vaultUrl(uuid, 'actividad'), {
        params: { cursor: params.cursor ?? undefined, limite: params.limite },
    });

    return unwrap<PaginaActividad>(data);
};
