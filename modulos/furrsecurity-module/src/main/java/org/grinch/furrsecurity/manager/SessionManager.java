package org.grinch.furrsecurity.manager;

import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.platform.PlatformHandler.TaskHandle;
import org.grinch.furrsecurity.util.Messages;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Avisos y caducidad de la sesion verificada de cada jugador. Las llamadas llegan ya serializadas por jugador. */
final class SessionManager {

    private static final long SAME_EXPIRY_TOLERANCE_MILLIS = 5_000;

    private final FurrSecurity core;
    private final VerificationManager verifier;
    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

    SessionManager(FurrSecurity core, VerificationManager verifier) {
        this.core = core;
        this.verifier = verifier;
    }

    /**
     * Idempotente: si ya hay una sesion con la misma caducidad (±5 s) no reprograma nada, asi un cambio
     * de servidor no duplica avisos. Con 0 segundos o menos la sesion caduca ya.
     */
    void start(UUID uuid, long remainingSeconds) {
        if (remainingSeconds <= 0) {
            cancel(uuid);
            verifier.onSessionExpired(uuid);
            return;
        }
        long expiresAt = System.currentTimeMillis() + remainingSeconds * 1000;
        Session current = sessions.get(uuid);
        if (current != null && Math.abs(current.expiresAtMillis() - expiresAt) < SAME_EXPIRY_TOLERANCE_MILLIS) {
            return;
        }
        cancel(uuid);
        List<TaskHandle> tasks = new ArrayList<>();
        if (!core.isProxyMode()) { // detras de un proxy con FurrSecurity, avisa el proxy
            for (long secondsLeft : core.settings().alertTimes()) {
                if (secondsLeft < remainingSeconds) {
                    tasks.add(core.platform().schedule(() -> alert(uuid, secondsLeft),
                            (remainingSeconds - secondsLeft) * 1000));
                }
            }
        }
        tasks.add(core.platform().schedule(() -> expire(uuid, expiresAt), remainingSeconds * 1000));
        sessions.put(uuid, new Session(expiresAt, List.copyOf(tasks)));
    }

    long remainingSeconds(UUID uuid) {
        Session session = sessions.get(uuid);
        return session == null ? -1 : Math.max(0, (session.expiresAtMillis() - System.currentTimeMillis()) / 1000);
    }

    void cancel(UUID uuid) {
        Session session = sessions.remove(uuid);
        if (session != null) {
            session.tasks().forEach(TaskHandle::cancel);
        }
    }

    void cancelAll() {
        List.copyOf(sessions.keySet()).forEach(this::cancel);
    }

    private void alert(UUID uuid, long secondsLeft) {
        String time = Messages.formatTime(secondsLeft);
        core.platform().sendMessage(uuid, core.messages().prefixed("session_expiring", "time", time, "time_remaining", time));
        if (secondsLeft <= core.settings().earlyVerifySeconds()) {
            verifier.offerEarlyVerification(uuid);
        }
    }

    private void expire(UUID uuid, long expiresAt) {
        Session session = sessions.get(uuid);
        if (session != null && session.expiresAtMillis() == expiresAt && sessions.remove(uuid, session)) {
            verifier.onSessionExpired(uuid);
        }
    }

    private record Session(long expiresAtMillis, List<TaskHandle> tasks) {
    }
}
