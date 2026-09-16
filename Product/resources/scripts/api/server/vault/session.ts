import http from '@/api/http';
import { unwrap, vaultUrl } from '@/api/server/vault/client';
import { EstadoVault } from '@/api/server/vault/types';

/** `GET /vault` — `{sesion: null}` before signing in with Discord, otherwise the identity and its summary. */
export const getVaultState = async (uuid: string): Promise<EstadoVault> => {
    const { data } = await http.get(vaultUrl(uuid));

    return unwrap<EstadoVault>(data);
};

/** `POST /vault/logout` — closes the Discord session of the Vault (the panel session is untouched). */
export const logoutVault = async (uuid: string): Promise<void> => {
    await http.post(vaultUrl(uuid, 'logout'));
};
