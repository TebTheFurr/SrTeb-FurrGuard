/**
 * Client API of Tebby Vault (vault/docs/PTERODACTYL.md §8.3). Every call goes
 * through the panel, which signs it for the vault and forwards the Discord
 * session stored server-side; the browser never talks to the vault directly.
 */
export * from '@/api/server/vault/types';
export {
    vaultErrorCode,
    vaultErrorStatus,
    isVaultSessionError,
    isServerLockedError,
} from '@/api/server/vault/client';
export { getVaultState, logoutVault } from '@/api/server/vault/session';
export { listVault, countVaultCopies, getVaultDownloadUrl, getVaultZipUrl } from '@/api/server/vault/files';
export type { ListarParams, ZipParams } from '@/api/server/vault/files';
export { createVaultBackup, deleteVaultBackup, pinVaultBackup } from '@/api/server/vault/backups';
export { restoreVault, syncVault, getVaultJobs, getVaultJob, cancelVaultJob } from '@/api/server/vault/jobs';
export { updateVaultExclusions } from '@/api/server/vault/settings';
export { getVaultActivity } from '@/api/server/vault/activity';
export type { ActividadParams } from '@/api/server/vault/activity';
