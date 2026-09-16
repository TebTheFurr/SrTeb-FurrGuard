import http from '@/api/http';
import { backgroundHttp, unwrap, vaultUrl } from '@/api/server/vault/client';
import { RestaurarPeticion, Trabajo } from '@/api/server/vault/types';

/** `POST /vault/restaurar` — restores into the server through Wings. Requires `restaurar`. */
export const restoreVault = async (uuid: string, peticion: RestaurarPeticion): Promise<Trabajo> => {
    const { data } = await http.post(vaultUrl(uuid, 'restaurar'), peticion);

    return unwrap<{ trabajo: Trabajo }>(data).trabajo;
};

/** `POST /vault/sincronizar` — refreshes the Global and Mundos mirrors now. Requires `gestionar`. */
export const syncVault = async (uuid: string): Promise<Trabajo> => {
    const { data } = await http.post(vaultUrl(uuid, 'sincronizar'));

    return unwrap<{ trabajo: Trabajo }>(data).trabajo;
};

/** `GET /vault/trabajos` — most recent jobs of the server (the vault caps `limite` at 50). */
export const getVaultJobs = async (uuid: string, limite = 20): Promise<Trabajo[]> => {
    const { data } = await http.get(vaultUrl(uuid, 'trabajos'), { params: { limite: Math.min(limite, 50) } });

    return unwrap<{ trabajos: Trabajo[] }>(data).trabajos;
};

/**
 * `GET /vault/trabajos/{id}`. Pass `background` when polling so the request
 * does not animate the global progress bar.
 */
export const getVaultJob = async (uuid: string, id: string, background = false): Promise<Trabajo> => {
    const client = background ? backgroundHttp : http;
    const { data } = await client.get(vaultUrl(uuid, `trabajos/${encodeURIComponent(id)}`));

    return unwrap<{ trabajo: Trabajo }>(data).trabajo;
};

/** `POST /vault/trabajos/{id}/cancelar` — also stops the Wings side. Requires `gestionar`. */
export const cancelVaultJob = async (uuid: string, id: string): Promise<Trabajo> => {
    const { data } = await http.post(vaultUrl(uuid, `trabajos/${encodeURIComponent(id)}/cancelar`));

    return unwrap<{ trabajo: Trabajo }>(data).trabajo;
};
