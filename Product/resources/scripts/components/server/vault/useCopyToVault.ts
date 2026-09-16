import { useCallback, useState } from 'react';
import { createVaultBackup, isVaultSessionError } from '@/api/server/vault';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { serverRelativePaths } from '@/components/server/vault/vaultRules';

/** Window event consumed by VaultCopyNotice, so any file manager control can report the outcome. */
export const VAULT_COPY_EVENT = 'luna:vault:copy';

export type VaultCopyOutcome = { kind: 'started'; count: number } | { kind: 'sign_in' };

const FILES_FLASH_KEY = 'files';

const announce = (detail: VaultCopyOutcome) =>
    window.dispatchEvent(new CustomEvent<VaultCopyOutcome>(VAULT_COPY_EVENT, { detail }));

/**
 * "Copy to Vault (M-Backup)" from the file manager: an M-Backup limited to the
 * picked paths (`alcance: "rutas"`, paths relative to the server root).
 */
const useCopyToVault = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const vaultEnabled = ServerContext.useStoreState((state) => state.server.data!.vaultEnabled);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [copying, setCopying] = useState(false);

    /** Resolves to true when the M-Backup job was accepted. */
    const copyToVault = useCallback(
        (directory: string, names: string[]): Promise<boolean> => {
            const rutas = serverRelativePaths(directory, names);
            if (!vaultEnabled || rutas.length === 0) return Promise.resolve(false);

            setCopying(true);
            clearFlashes(FILES_FLASH_KEY);

            return createVaultBackup(uuid, { alcance: 'rutas', rutas })
                .then(() => {
                    announce({ kind: 'started', count: rutas.length });
                    return true;
                })
                .catch((error) => {
                    if (isVaultSessionError(error)) {
                        announce({ kind: 'sign_in' });
                    } else {
                        clearAndAddHttpError({ key: FILES_FLASH_KEY, error });
                    }
                    return false;
                })
                .then((accepted) => {
                    setCopying(false);
                    return accepted;
                });
        },
        [uuid, vaultEnabled]
    );

    return { vaultEnabled, copying, copyToVault };
};

export default useCopyToVault;
