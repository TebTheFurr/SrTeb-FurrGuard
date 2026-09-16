import http from '@/api/http';
import { unwrap, vaultUrl } from '@/api/server/vault/client';

/** `PUT /vault/exclusiones` — gitignore-style patterns skipped by syncs and backups. Requires `gestionar`. */
export const updateVaultExclusions = async (uuid: string, exclusiones: string[]): Promise<string[]> => {
    const { data } = await http.put(vaultUrl(uuid, 'exclusiones'), { exclusiones });

    return unwrap<{ exclusiones: string[] }>(data).exclusiones;
};
