import { backgroundHttp } from '@/api/server/vault/client';
import { ServerStatus } from '@/api/server/types';

/**
 * Current install/restore status of a server, fetched without touching the
 * global progress bar. The server view route stays readable while Pterodactyl
 * locks every other route during a restore.
 */
export const getServerLockStatus = async (uuid: string): Promise<ServerStatus> => {
    const { data } = await backgroundHttp.get(`/api/client/servers/${uuid}`);

    return (data?.attributes?.status ?? null) as ServerStatus;
};
