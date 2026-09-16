import { useEffect, useRef, useState } from 'react';
import { getVaultJob, isServerLockedError, isVaultSessionError, Trabajo } from '@/api/server/vault';
import { isJobActive } from '@/components/server/vault/vaultFormat';

/** Contract: the page polls `trabajos/{id}` every 2 s while the job is active. */
export const JOB_POLL_MS = 2000;
/** While Pterodactyl locks the server for a restore, checking more often is pointless. */
export const LOCKED_POLL_MS = 5000;
const MAX_BACKOFF_MS = 30000;
const FAILURES_BEFORE_WARNING = 3;

interface Handlers {
    onUpdate: (job: Trabajo) => void;
    onFinished: (job: Trabajo) => void;
    onSessionLost: () => void;
}

/**
 * Polls an active job until it reaches `ok`, `fallo` or `cancelado`. Requests
 * are chained (never overlapping) and go through the background client so the
 * global progress bar stays still.
 */
const useVaultJobPolling = (uuid: string, job: Trabajo | null, handlers: Handlers) => {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    const [locked, setLocked] = useState(false);
    const [failing, setFailing] = useState(false);

    const jobId = job?.id ?? null;
    const active = isJobActive(job);

    useEffect(() => {
        if (!jobId || !active) {
            setLocked(false);
            setFailing(false);
            return;
        }

        let cancelled = false;
        let failures = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const schedule = (delay: number) => {
            timer = setTimeout(tick, delay);
        };

        const tick = () => {
            getVaultJob(uuid, jobId, true)
                .then((next) => {
                    if (cancelled) return;

                    failures = 0;
                    setLocked(false);
                    setFailing(false);

                    if (isJobActive(next)) {
                        handlersRef.current.onUpdate(next);
                        schedule(JOB_POLL_MS);
                    } else {
                        handlersRef.current.onFinished(next);
                    }
                })
                .catch((error) => {
                    if (cancelled) return;

                    if (isVaultSessionError(error)) {
                        handlersRef.current.onSessionLost();
                        return;
                    }

                    if (isServerLockedError(error)) {
                        setLocked(true);
                        schedule(LOCKED_POLL_MS);
                        return;
                    }

                    failures += 1;
                    setFailing(failures >= FAILURES_BEFORE_WARNING);
                    schedule(Math.min(JOB_POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
                });
        };

        schedule(JOB_POLL_MS);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [uuid, jobId, active]);

    return { locked, failing };
};

export default useVaultJobPolling;
