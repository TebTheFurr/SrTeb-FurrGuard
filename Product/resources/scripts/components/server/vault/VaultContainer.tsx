import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect } from 'react-router-dom';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import { faLock, faRedo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { httpErrorToHuman } from '@/api/http';
import { getVaultState, isServerLockedError, isVaultSessionError, Resumen } from '@/api/server/vault';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { VAULT_FLASH_KEY } from '@/components/server/vault/VaultContext';
import VaultLoginGate from '@/components/server/vault/VaultLoginGate';
import VaultWorkspace from '@/components/server/vault/VaultWorkspace';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';

type PageState =
    | { kind: 'loading' }
    | { kind: 'signed_out' }
    | { kind: 'locked' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; resumen: Resumen };

const VaultPage = () => {
    const { t } = useVaultTranslation();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const serverLocked = ServerContext.useStoreState((state) => state.server.data!.status === 'restoring_backup');
    const { addFlash, clearAndAddHttpError } = useFlash();
    const [state, setState] = useState<PageState>({ kind: 'loading' });
    const mounted = useRef(true);
    const stateKind = useRef(state.kind);
    stateKind.current = state.kind;

    /** `quiet` keeps the current page on screen and reports failures as a flash. */
    const load = useCallback(
        (quiet: boolean) => {
            if (!quiet) setState({ kind: 'loading' });

            return getVaultState(uuid)
                .then((estado) => {
                    if (!mounted.current) return;
                    setState(estado.sesion === null ? { kind: 'signed_out' } : { kind: 'ready', resumen: estado.resumen });
                })
                .catch((error) => {
                    if (!mounted.current) return;

                    if (isVaultSessionError(error)) {
                        setState({ kind: 'signed_out' });
                    } else if (isServerLockedError(error)) {
                        if (!quiet) setState({ kind: 'locked' });
                    } else if (quiet) {
                        clearAndAddHttpError({ key: VAULT_FLASH_KEY, error });
                    } else {
                        setState({ kind: 'error', message: httpErrorToHuman(error) });
                    }
                });
        },
        [uuid]
    );

    useEffect(() => {
        mounted.current = true;
        load(false);

        return () => {
            mounted.current = false;
        };
    }, [load]);

    // Once a restore lock is lifted, reload whatever the lock was hiding.
    const wasLocked = useRef(serverLocked);
    useEffect(() => {
        if (wasLocked.current && !serverLocked) {
            load(stateKind.current === 'ready');
        }
        wasLocked.current = serverLocked;
    }, [serverLocked, load]);

    const onSessionLost = useCallback(() => {
        addFlash({
            key: VAULT_FLASH_KEY,
            type: 'warning',
            title: t('vault.title', 'Vault'),
            message: t('vault.login.expired', 'Tu sesión del Vault ha caducado. Vuelve a entrar con Discord.'),
        });
        setState({ kind: 'signed_out' });
    }, [t]);

    const refresh = useCallback(() => {
        load(true);
    }, [load]);

    switch (state.kind) {
        case 'loading':
            return <Spinner size={'large'} centered />;
        case 'signed_out':
            return <VaultLoginGate />;
        case 'locked':
            return (
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
            );
        case 'error':
            return (
                <Notice $tone={'danger'}>
                    <NoticeBody>
                        <strong>{t('vault.errors.load_title', 'No se pudo cargar el Vault')}</strong>
                        <p>{state.message}</p>
                    </NoticeBody>
                    <Button size={Button.Sizes.Small} onClick={() => load(false)}>
                        <FontAwesomeIcon icon={faRedo} />
                        <span className={'ml-2'}>{t('vault.actions.retry', 'Reintentar')}</span>
                    </Button>
                </Notice>
            );
        default:
            return (
                <VaultWorkspace
                    resumen={state.resumen}
                    onRefresh={refresh}
                    onSessionLost={onSessionLost}
                    onSignedOut={() => setState({ kind: 'signed_out' })}
                />
            );
    }
};

const VaultContainer = () => {
    const { t } = useVaultTranslation();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const vaultEnabled = ServerContext.useStoreState((state) => state.server.data!.vaultEnabled);

    if (!vaultEnabled) {
        return <Redirect to={`/server/${id}`} />;
    }

    return (
        <ServerContentBlock title={t('vault.title', 'Vault')} showFlashKey={VAULT_FLASH_KEY}>
            <VaultPage />
        </ServerContentBlock>
    );
};

export default VaultContainer;
