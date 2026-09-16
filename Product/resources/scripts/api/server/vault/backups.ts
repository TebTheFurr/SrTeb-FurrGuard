import http from '@/api/http';
import { unwrap, vaultUrl } from '@/api/server/vault/client';
import { Backup, CarpetaCopias, CrearBackupPeticion, Trabajo } from '@/api/server/vault/types';

const backupUrl = (uuid: string, carpeta: CarpetaCopias, nombre: string, suffix = ''): string =>
    vaultUrl(uuid, `backups/${encodeURIComponent(carpeta)}/${encodeURIComponent(nombre)}${suffix}`);

/** `POST /vault/backups` — starts an M-Backup. Requires `gestionar`. */
export const createVaultBackup = async (uuid: string, peticion: CrearBackupPeticion): Promise<Trabajo> => {
    const { data } = await http.post(vaultUrl(uuid, 'backups'), peticion);

    return unwrap<{ trabajo: Trabajo }>(data).trabajo;
};

/** `DELETE /vault/backups/{carpeta}/{nombre}` — `gestionar` for M-Backups, vault admin for Backups. */
export const deleteVaultBackup = async (uuid: string, carpeta: CarpetaCopias, nombre: string): Promise<void> => {
    await http.delete(backupUrl(uuid, carpeta, nombre));
};

/** `POST /vault/backups/{carpeta}/{nombre}/fijar` — pinned copies cannot be deleted or pruned. */
export const pinVaultBackup = async (
    uuid: string,
    carpeta: CarpetaCopias,
    nombre: string,
    fijada: boolean
): Promise<Backup> => {
    const { data } = await http.post(backupUrl(uuid, carpeta, nombre, '/fijar'), { fijada });

    return unwrap<{ backup: Backup }>(data).backup;
};
