import { useEffect } from 'react';
import { ServerContext } from '@/state/server';
import { getServerLockStatus } from '@/api/server/vault/serverStatus';

/** How often the lock is checked while a Vault restore keeps the server in `restoring_backup`. */
export const RESTORE_LOCK_POLL_MS = 5000;

/**
 * Native restores clear `restoring_backup` through a Wings websocket event.
 * Vault restores have no such event: the panel clears the status on its next
 * `vault:tick`. Without this listener every page would stay on the "Restoring
 * from Backup" screen until a manual reload.
 */
const VaultRestoreListener = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const vaultEnabled = ServerContext.useStoreState((state) => state.server.data?.vaultEnabled ?? false);
    const restoring = ServerContext.useStoreState((state) => state.server.data?.status === 'restoring_backup');
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);

    useEffect(() => {
        if (!uuid || !vaultEnabled || !restoring) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const check = () => {
            getServerLockStatus(uuid)
                .then((status) => {
                    if (cancelled) return;
                    if (status === 'restoring_backup') {
                        timer = setTimeout(check, RESTORE_LOCK_POLL_MS);
                        return;
                    }

                    return getServer(uuid);
                })
                .catch((error) => {
                    if (cancelled) return;
                    console.error('Could not check the restore status of the server.', error);
                    timer = setTimeout(check, RESTORE_LOCK_POLL_MS);
                });
        };

        timer = setTimeout(check, RESTORE_LOCK_POLL_MS);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [uuid, vaultEnabled, restoring]);

    return null;
};

export default VaultRestoreListener;
