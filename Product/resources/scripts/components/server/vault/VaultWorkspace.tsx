import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { isServerLockedError, isVaultSessionError, Resumen, Trabajo } from '@/api/server/vault';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { VAULT_FLASH_KEY, VaultContext, VaultContextValue } from '@/components/server/vault/VaultContext';
import useVaultLocation, { VaultTab } from '@/components/server/vault/useVaultLocation';
import useVaultJobPolling from '@/components/server/vault/useVaultJobPolling';
import { isJobActive } from '@/components/server/vault/vaultFormat';
import { isFolder, levelAllows, RestoreSource } from '@/components/server/vault/vaultRules';
import { Notice, NoticeBody, Stack } from '@/components/server/vault/vaultStyles';
import VaultHeader from '@/components/server/vault/VaultHeader';
import VaultJobBar from '@/components/server/vault/VaultJobBar';
import VaultTabs from '@/components/server/vault/VaultTabs';
import VaultExplorer from '@/components/server/vault/VaultExplorer';
import VaultActivity from '@/components/server/vault/VaultActivity';
import VaultExclusions from '@/components/server/vault/VaultExclusions';
import VaultRestoreDialog from '@/components/server/vault/VaultRestoreDialog';
import VaultCreateBackupDialog from '@/components/server/vault/VaultCreateBackupDialog';

interface Props {
    resumen: Resumen;
    onRefresh: () => void;
    onSessionLost: () => void;
    onSignedOut: () => void;
}

const RECENT_JOBS_KEPT = 10;

const VaultWorkspace = ({ resumen, onRefresh, onSessionLost, onSignedOut }: Props) => {
    const { t } = useVaultTranslation();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const serverLocked = ServerContext.useStoreState((state) => state.server.data!.status === 'restoring_backup');
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const { tab, ruta, navigate } = useVaultLocation();

    const [job, setJob] = useState<Trabajo | null>(isJobActive(resumen.trabajo_activo) ? resumen.trabajo_activo : null);
    const [listingVersion, setListingVersion] = useState(0);
    const [restoreSource, setRestoreSource] = useState<RestoreSource | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const finishedJobs = useRef<string[]>([]);

    const canRestore = levelAllows(resumen.nivel, 'restaurar');
    const canManage = levelAllows(resumen.nivel, 'gestionar');

    // Adopt jobs started elsewhere (daily backup, another user) when nothing is tracked.
    const activeFromSummary = resumen.trabajo_activo;
    useEffect(() => {
        if (isJobActive(activeFromSummary) && finishedJobs.current.indexOf(activeFromSummary.id) === -1) {
            setJob((current) => (isJobActive(current) ? current : activeFromSummary));
        }
    }, [activeFromSummary?.id, activeFromSummary?.estado]);

    const reloadListings = useCallback(() => setListingVersion((version) => version + 1), []);

    const interceptError = useCallback(
        (error: unknown): boolean => {
            if (isVaultSessionError(error)) {
                onSessionLost();
                return true;
            }

            if (isServerLockedError(error)) {
                addFlash({
                    key: VAULT_FLASH_KEY,
                    type: 'info',
                    title: t('vault.title', 'Vault'),
                    message: t('vault.locked.action', 'El servidor se está restaurando. Vuelve a intentarlo cuando termine.'),
                });
                return true;
            }

            return false;
        },
        [onSessionLost, t]
    );

    const reportError = useCallback(
        (error: unknown) => {
            if (!interceptError(error)) {
                clearAndAddHttpError({ key: VAULT_FLASH_KEY, error });
            }
        },
        [interceptError]
    );

    const finishJob = useCallback(
        (finished: Trabajo) => {
            finishedJobs.current = [...finishedJobs.current, finished.id].slice(-RECENT_JOBS_KEPT);
            setJob(null);
            clearFlashes(VAULT_FLASH_KEY);

            if (finished.estado === 'ok') {
                const warnings = finished.resultado?.avisos ?? [];
                addFlash({
                    key: VAULT_FLASH_KEY,
                    type: warnings.length > 0 ? 'warning' : 'success',
                    title: t('vault.job.finished_title', 'Hecho'),
                    message: warnings.length > 0 ? `${finished.resumen} — ${warnings.join(' · ')}` : finished.resumen,
                });
            } else if (finished.estado === 'cancelado') {
                addFlash({
                    key: VAULT_FLASH_KEY,
                    type: 'info',
                    title: t('vault.job.cancelled_title', 'Cancelado'),
                    message: finished.resumen,
                });
            } else {
                addFlash({
                    key: VAULT_FLASH_KEY,
                    type: 'error',
                    title: t('vault.job.failed_title', 'Error'),
                    message: finished.error ? `${finished.resumen}: ${finished.error}` : finished.resumen,
                });
            }

            reloadListings();
            onRefresh();
        },
        [onRefresh, reloadListings, t]
    );

    const { locked: pollLocked, failing } = useVaultJobPolling(uuid, job, {
        onUpdate: setJob,
        onFinished: finishJob,
        onSessionLost,
    });

    const startJob = useCallback(
        (started: Trabajo) => {
            clearFlashes(VAULT_FLASH_KEY);
            if (isJobActive(started)) {
                setJob(started);
                onRefresh();
            } else {
                finishJob(started);
            }
        },
        [finishJob, onRefresh]
    );

    const openCreateBackup = useCallback(() => {
        if (canManage) setCreateOpen(true);
    }, [canManage]);

    useEffect(() => {
        window.addEventListener('luna:keybind:create-backup', openCreateBackup as EventListener);

        return () => window.removeEventListener('luna:keybind:create-backup', openCreateBackup as EventListener);
    }, [openCreateBackup]);

    const value = useMemo<VaultContextValue>(
        () => ({
            uuid,
            serverId,
            resumen,
            canRestore,
            canManage,
            isVaultAdmin: resumen.admin_vault,
            job,
            jobActive: isJobActive(job),
            serverLocked,
            listingVersion,
            startJob,
            refresh: onRefresh,
            reloadListings,
            interceptError,
            reportError,
            openRestore: setRestoreSource,
            openCreateBackup,
        }),
        [uuid, serverId, resumen, canRestore, canManage, job, serverLocked, listingVersion, startJob, onRefresh, reloadListings, interceptError, reportError, openCreateBackup]
    );

    const activeTab: VaultTab = tab === 'exclusiones' && !canManage ? 'Global' : tab;

    return (
        <VaultContext.Provider value={value}>
            <VaultHeader onSignedOut={onSignedOut} />
            <Stack>
                {serverLocked && (
                    <Notice $tone={'info'}>
                        <FontAwesomeIcon icon={faLock} />
                        <NoticeBody>
                            <strong>{t('vault.locked.title', 'Restauración en curso')}</strong>
                            <p>
                                {t(
                                    'vault.locked.message',
                                    'El servidor está bloqueado mientras el Vault lo restaura. Esta página se recargará sola cuando termine.'
                                )}
                            </p>
                        </NoticeBody>
                    </Notice>
                )}
                {job && <VaultJobBar job={job} locked={pollLocked} failing={failing} />}
                <VaultTabs active={activeTab} onSelect={(next) => navigate(next)} />
                {isFolder(activeTab) ? (
                    <VaultExplorer
                        key={activeTab}
                        carpeta={activeTab}
                        ruta={ruta}
                        onNavigate={(next) => navigate(activeTab, next)}
                    />
                ) : activeTab === 'actividad' ? (
                    <VaultActivity />
                ) : (
                    <VaultExclusions />
                )}
            </Stack>
            <VaultRestoreDialog source={restoreSource} onClose={() => setRestoreSource(null)} />
            <VaultCreateBackupDialog open={createOpen} onClose={() => setCreateOpen(false)} />
        </VaultContext.Provider>
    );
};

export default VaultWorkspace;
