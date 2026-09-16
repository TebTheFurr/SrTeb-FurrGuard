import { createContext, useContext } from 'react';
import { Resumen, Trabajo } from '@/api/server/vault/types';
import { RestoreSource } from '@/components/server/vault/vaultRules';

/** Flash key of the Vault page (rendered by its ServerContentBlock). */
export const VAULT_FLASH_KEY = 'vault';

export interface VaultContextValue {
    /** Long server uuid used by the client API. */
    uuid: string;
    /** Short identifier used in panel URLs and by the vault (`servidor`). */
    serverId: string;
    resumen: Resumen;
    canRestore: boolean;
    canManage: boolean;
    /** Vault founder or admin: may delete daily backups. */
    isVaultAdmin: boolean;
    job: Trabajo | null;
    jobActive: boolean;
    /** Pterodactyl reports the server as `restoring_backup`. */
    serverLocked: boolean;
    /** Bumped after jobs finish so open listings reload. */
    listingVersion: number;
    startJob: (job: Trabajo) => void;
    refresh: () => void;
    reloadListings: () => void;
    /** Handles session loss and the restore lock; returns true when the error was consumed. */
    interceptError: (error: unknown) => boolean;
    /** interceptError, then a Pterodactyl-style flash for anything else. */
    reportError: (error: unknown) => void;
    openRestore: (source: RestoreSource) => void;
    openCreateBackup: () => void;
}

export const VaultContext = createContext<VaultContextValue | null>(null);

export const useVault = (): VaultContextValue => {
    const value = useContext(VaultContext);
    if (!value) {
        throw new Error('useVault() must be used inside the Vault page.');
    }

    return value;
};
