import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { furrError, getFurrGuardState, isFurrSessionError, logoutFurrGuard } from '@/api/furrguard/client';
import { FurrSession, Section } from '@/api/furrguard/types';
import PageContentBlock from '@/components/elements/PageContentBlock';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { FURRGUARD_FLASH_KEY, FurrGuardContext, FurrGuardContextValue, NoticeType } from '@/components/furrguard/FurrGuardContext';
import FurrGuardLoginGate from '@/components/furrguard/FurrGuardLoginGate';
import FurrGuardShell from '@/components/furrguard/FurrGuardShell';
import { sanitizeSections } from '@/components/furrguard/sections';
import { RetryNotice } from '@/components/furrguard/ui';
import useFurrGuardTranslation from '@/components/furrguard/useFurrGuardTranslation';

const HIDE_IPS_KEY = 'furrguard.hideIps';
const SUCCESS_TIMEOUT_MS = 4500;

type PageState =
    | { kind: 'loading' }
    | { kind: 'signed_out'; reason: string | null }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; session: FurrSession };

const readHideIps = (): boolean => {
    try {
        return localStorage.getItem(HIDE_IPS_KEY) === '1';
    } catch {
        return false;
    }
};

const FurrGuardPage = () => {
    const { t } = useFurrGuardTranslation();
    const history = useHistory();
    const { addFlash, clearFlashes } = useFlash();
    const [state, setState] = useState<PageState>({ kind: 'loading' });
    const [hideIps, setHideIpsState] = useState(readHideIps);
    const mounted = useRef(true);
    const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** `quiet` keeps the current page on screen while the session is re-checked. */
    const load = useCallback((quiet: boolean) => {
        if (!quiet) setState({ kind: 'loading' });

        return getFurrGuardState()
            .then(({ session }) => {
                if (!mounted.current) return;
                setState(session ? { kind: 'ready', session } : { kind: 'signed_out', reason: null });
            })
            .catch((error) => {
                if (!mounted.current) return;
                if (isFurrSessionError(error)) {
                    setState({ kind: 'signed_out', reason: furrError(error).code });
                } else if (!quiet) {
                    setState({ kind: 'error', message: furrError(error).message });
                }
            });
    }, []);

    useEffect(() => {
        mounted.current = true;
        load(false);

        return () => {
            mounted.current = false;
            if (successTimer.current) clearTimeout(successTimer.current);
            clearFlashes(FURRGUARD_FLASH_KEY);
        };
    }, [load]);

    const setHideIps = useCallback((hidden: boolean) => {
        setHideIpsState(hidden);
        try {
            localStorage.setItem(HIDE_IPS_KEY, hidden ? '1' : '0');
        } catch {
            // Storage blocked: the switch still works during the visit.
        }
    }, []);

    const notify = useCallback(
        (message: string, type: NoticeType = 'info') => {
            clearFlashes(FURRGUARD_FLASH_KEY);
            addFlash({ key: FURRGUARD_FLASH_KEY, type, message });
            if (successTimer.current) clearTimeout(successTimer.current);
            if (type === 'success' || type === 'info') {
                successTimer.current = setTimeout(() => clearFlashes(FURRGUARD_FLASH_KEY), SUCCESS_TIMEOUT_MS);
            }
        },
        [addFlash, clearFlashes]
    );

    const onSessionLost = useCallback(
        (reason: string | null) => {
            clearFlashes(FURRGUARD_FLASH_KEY);
            setState({ kind: 'signed_out', reason: reason ?? 'session_expired' });
        },
        [clearFlashes]
    );

    const interceptError = useCallback(
        (error: unknown): boolean => {
            if (!isFurrSessionError(error)) return false;
            onSessionLost(furrError(error).code);

            return true;
        },
        [onSessionLost]
    );

    const notifyError = useCallback(
        (error: unknown, fallback = 'Algo ha fallado.') => {
            if (interceptError(error)) return;
            const parsed = furrError(error);
            notify(parsed.message || fallback, 'error');
        },
        [interceptError, notify]
    );

    const signOut = useCallback(() => {
        logoutFurrGuard()
            .catch(() => undefined)
            .then(() => {
                if (!mounted.current) return;
                clearFlashes(FURRGUARD_FLASH_KEY);
                history.replace('/furrguard');
                setState({ kind: 'signed_out', reason: null });
            });
    }, [clearFlashes, history]);

    const session = state.kind === 'ready' ? state.session : null;
    const permissions = useMemo(() => (session ? sanitizeSections(session.permissions) : []), [session]);

    const context = useMemo<FurrGuardContextValue | null>(() => {
        if (!session) return null;

        return {
            user: session.user,
            permissions,
            can: (section: Section) => permissions.includes(section),
            canSeeIps: session.can_see_ips === true,
            hideIps,
            setHideIps,
            notify,
            notifyError,
            interceptError,
            refreshSession: () => load(true),
            signOut,
        };
    }, [session, permissions, hideIps, setHideIps, notify, notifyError, interceptError, load, signOut]);

    switch (state.kind) {
        case 'loading':
            return <Spinner size={'large'} centered />;
        case 'signed_out':
            return <FurrGuardLoginGate lostReason={state.reason} />;
        case 'error':
            return <RetryNotice title={t('furrguard.errors.load_title', 'No se pudo cargar FurrGuard')} message={state.message} onRetry={() => load(false)} />;
        default:
            return (
                <FurrGuardContext.Provider value={context}>
                    <FurrGuardShell />
                </FurrGuardContext.Provider>
            );
    }
};

const FurrGuardContainer = () => {
    const { t } = useFurrGuardTranslation();

    return (
        <PageContentBlock title={t('furrguard.title', 'FurrGuard')} showFlashKey={FURRGUARD_FLASH_KEY}>
            <FurrGuardPage />
        </PageContentBlock>
    );
};

export default FurrGuardContainer;
