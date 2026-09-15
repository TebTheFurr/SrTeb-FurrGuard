package org.grinch.furrsecurity.manager;

import net.kyori.adventure.text.Component;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.api.Replies;
import org.grinch.furrsecurity.api.Replies.CheckStatus;
import org.grinch.furrsecurity.api.Replies.TokenGrant;
import org.grinch.furrsecurity.api.Replies.TokenStatus;
import org.grinch.furrsecurity.platform.PlatformHandler.PlayerInfo;
import org.grinch.furrsecurity.platform.PlatformHandler.TaskHandle;
import org.grinch.furrsecurity.util.Messages;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Flujo de verificacion por jugador. Falla en cerrado: un candidato a staff se bloquea al entrar,
 * antes de cualquier HTTP, y solo se desbloquea con {@code check_status} {@code needs_verification:false}
 * o con un token {@code verified}. Cualquier otro resultado mantiene el bloqueo y reintenta.
 *
 * <p>Cada respuesta asincrona comprueba que el jugador sigue conectado y que el flujo no ha cambiado
 * ({@code epoch}): una respuesta vieja nunca desbloquea tras un {@code /fsec reset}.
 */
public final class VerificationManager {

    public enum Status { UNCHECKED, LOCKED, VERIFIED, EXEMPT, NOT_STAFF }

    static final long POLL_MILLIS = 5_000;
    static final int MAX_TOKEN_RESTARTS = 3;
    private static final long NOTICE_GAP_MILLIS = 2_000;

    private final FurrSecurity core;
    private final SessionManager sessions;
    private final Map<UUID, PlayerState> states = new ConcurrentHashMap<>();
    private final Set<UUID> locked = ConcurrentHashMap.newKeySet();
    private final Map<UUID, Long> lastNotice = new ConcurrentHashMap<>();
    private volatile boolean closed;

    public VerificationManager(FurrSecurity core) {
        this.core = core;
        this.sessions = new SessionManager(core, this);
    }

    // ---- consultas ----

    public boolean isLocked(UUID uuid) {
        return locked.contains(uuid);
    }

    public Set<UUID> lockedPlayers() {
        return Set.copyOf(locked);
    }

    public Optional<Status> status(UUID uuid) {
        return Optional.ofNullable(states.get(uuid)).map(state -> state.status);
    }

    /** Segundos de sesion que quedan segun los temporizadores locales, o -1. */
    public long sessionSeconds(UUID uuid) {
        return sessions.remainingSeconds(uuid);
    }

    /** Aviso de accion bloqueada, como mucho uno cada 2 s por jugador. */
    public void noticeLocked(UUID uuid, String messageKey) {
        long now = System.currentTimeMillis();
        Long previous = lastNotice.get(uuid);
        if (previous == null || now - previous >= NOTICE_GAP_MILLIS) {
            lastNotice.put(uuid, now);
            core.platform().sendMessage(uuid, core.messages().prefixed(messageKey));
        }
    }

    // ---- ciclo de vida del jugador ----

    /** Al entrar. {@code startNow=false} (Velocity) bloquea ya y espera a {@link #onServerReady} para hablar con la API. */
    public void onJoin(PlayerInfo player, boolean startNow) {
        PlayerState state = new PlayerState(player);
        PlayerState previous = states.put(player.uuid(), state);
        if (previous != null) { // otra conexion con el mismo UUID que aun no ha salido
            synchronized (previous) {
                previous.epoch++;
                cancelTasks(previous);
            }
            sessions.cancel(player.uuid());
            if (locked.remove(player.uuid())) {
                core.platform().onUnlock(player.uuid());
            }
        }
        synchronized (state) {
            if (isCandidate(player)) {
                lockForFlow(state);
                if (startNow) {
                    startFlow(state);
                }
            }
        }
    }

    /** Velocity: el jugador ya esta en un servidor y puede recibir el enlace. */
    public void onServerReady(UUID uuid) {
        PlayerState state = states.get(uuid);
        if (state != null) {
            synchronized (state) {
                if (state.status == Status.LOCKED && !state.flowStarted) {
                    startFlow(state);
                }
            }
        }
    }

    public void onQuit(UUID uuid, Object handle) {
        PlayerState state = states.get(uuid);
        if (state == null || state.handle != handle || !states.remove(uuid, state)) {
            return;
        }
        boolean wasLocked;
        synchronized (state) {
            state.epoch++;
            cancelTasks(state);
            wasLocked = locked.remove(uuid);
        }
        sessions.cancel(uuid);
        lastNotice.remove(uuid);
        if (wasLocked) {
            core.platform().onUnlock(uuid);
        }
        if (state.tracked && !core.isProxyMode()) {
            core.api().postOnce("player_disconnect", Map.of("uuid", uuid.toString(), "nick", state.nick,
                    "locked", wasLocked ? "1" : "0"));
        }
    }

    /** Al arrancar con jugadores ya conectados (Paper): se tratan como si acabaran de entrar. */
    public void adoptOnlinePlayers() {
        for (PlayerInfo player : core.platform().onlinePlayers()) {
            if (!states.containsKey(player.uuid())) {
                onJoin(player, true);
            }
        }
    }

    /**
     * Tras refrescar la lista de staff (hilo principal en Paper): bloquea y comprueba a quien ahora es
     * candidato y nunca se comprobo; a los exentos o "no staff" les pregunta sin bloquearlos.
     */
    public void sweep() {
        for (PlayerInfo player : core.platform().onlinePlayers()) {
            PlayerState state = states.get(player.uuid());
            if (state == null || !isCandidate(player)) {
                continue;
            }
            synchronized (state) {
                switch (state.status) {
                    case UNCHECKED -> {
                        lockForFlow(state);
                        startFlow(state);
                    }
                    case EXEMPT, NOT_STAFF -> recheckUnlocked(state);
                    default -> {
                        // bloqueado o verificado: su flujo ya esta en marcha
                    }
                }
            }
        }
    }

    /**
     * {@code /fsec reset}: nunca desbloquea. Bloquea al momento, olvida sesion y enlace, y cuando la API
     * confirma el reseteo pide un enlace nuevo. Si la API falla se reintenta el reseteo, no el check.
     * Si el jugador acaba de desconectarse solo se resetea su sesion en la API.
     */
    public void reset(PlayerInfo player, Consumer<ApiResult> firstReply) {
        PlayerState state = states.get(player.uuid());
        if (state == null || state.handle != player.handle()) {
            core.api().post("reset_session", Map.of("uuid", player.uuid().toString(), "nick", player.nick()))
                    .thenAccept(firstReply);
            return;
        }
        synchronized (state) {
            sessions.cancel(player.uuid());
            cancelTasks(state);
            state.token = null;
            state.verifyUrl = null;
            lockForFlow(state);
            state.flowStarted = true;
            state.resetPending = true;
            sendReset(state, firstReply);
        }
    }

    /** Tras {@code /fsec reload}: los reintentos pendientes (hasta 60 s con una clave invalida) salen ya. */
    public void retryPendingNow() {
        for (PlayerState state : states.values()) {
            synchronized (state) {
                if (state.retry != null && state.retryAction != null) {
                    retryLater(state, 0, state.retryExpected, state.retryAction);
                }
            }
        }
    }

    public void shutdown() {
        closed = true;
        for (PlayerState state : states.values()) {
            synchronized (state) {
                cancelTasks(state);
            }
        }
        sessions.cancelAll();
        for (UUID uuid : Set.copyOf(locked)) {
            locked.remove(uuid);
            core.platform().onUnlock(uuid);
        }
        states.clear();
    }

    // ---- llamadas desde SessionManager ----

    void onSessionExpired(UUID uuid) {
        PlayerState state = states.get(uuid);
        if (state == null) {
            return;
        }
        synchronized (state) {
            if (state.status != Status.VERIFIED || closed) {
                return;
            }
            sessions.cancel(uuid);
            lockForFlow(state);
            state.flowStarted = true;
            core.platform().sendMessage(uuid, core.messages().prefixed("session_expired"));
            if (state.token != null) { // re-verificacion anticipada en curso: vale el mismo enlace
                sendLink(state, null);
            } else {
                requestToken(state);
            }
        }
    }

    void offerEarlyVerification(UUID uuid) {
        PlayerState state = states.get(uuid);
        if (state == null || core.isProxyMode()) {
            return;
        }
        synchronized (state) {
            if (state.status != Status.VERIFIED || closed) {
                return;
            }
            if (state.token != null) {
                sendLink(state, null);
                return;
            }
            int epoch = state.epoch;
            core.api().post("generate_token", identity(state)).thenAccept(result -> {
                synchronized (state) {
                    TokenGrant grant = TokenGrant.from(result);
                    if (stale(state, epoch) || state.status != Status.VERIFIED || state.token != null || grant == null) {
                        return; // se vuelve a ofrecer en el siguiente aviso
                    }
                    state.token = grant.token();
                    state.verifyUrl = grant.verifyUrl();
                    sendLink(state, null);
                    startPolling(state);
                }
            });
        }
    }

    // ---- flujo ----

    private boolean isCandidate(PlayerInfo player) {
        return core.isEnabled() && (player.staffPermission() || core.isListedStaff(player.nick()));
    }

    private void lockForFlow(PlayerState state) {
        state.epoch++;
        state.tracked = true;
        state.status = Status.LOCKED;
        state.flowStarted = false;
        state.failureLogged = false;
        cancelRetry(state);
        if (locked.add(state.uuid)) {
            core.platform().onLock(state.uuid);
            core.logger().info(state.nick + " bloqueado hasta verificar su identidad");
        }
    }

    private void unlock(PlayerState state) {
        cancelRetry(state);
        if (locked.remove(state.uuid)) {
            core.platform().onUnlock(state.uuid);
            core.logger().info(state.nick + " desbloqueado (" + state.status + ")");
        }
    }

    private void startFlow(PlayerState state) {
        state.flowStarted = true;
        checkStatus(state);
    }

    private void checkStatus(PlayerState state) {
        if (state.resetPending) {
            return;
        }
        int epoch = state.epoch;
        core.api().post("check_status", identity(state)).thenAccept(result -> onCheckStatus(state, epoch, result));
    }

    private void onCheckStatus(PlayerState state, int epoch, ApiResult result) {
        synchronized (state) {
            if (stale(state, epoch) || state.status != Status.LOCKED) {
                return;
            }
            CheckStatus status = CheckStatus.from(result);
            switch (status.decision()) {
                case UNLOCK -> release(state, status);
                case VERIFY -> {
                    if ("ip_changed".equals(status.reason())) {
                        core.logger().warn(state.nick + " entra desde otra IP que la de su sesion: debe verificar de nuevo");
                    }
                    requestToken(state);
                }
                case RETRY -> retryLater(state, result, Status.LOCKED, this::checkStatus);
            }
        }
    }

    private void release(PlayerState state, CheckStatus status) {
        switch (status.reason()) {
            case "already_verified" -> state.status = Status.VERIFIED;
            case "not_staff" -> {
                state.status = Status.NOT_STAFF;
                state.tracked = false;
            }
            default -> state.status = Status.EXEMPT; // module_disabled u otro motivo del servidor
        }
        state.tokenRestarts = 0;
        unlock(state);
        if (state.status == Status.VERIFIED) {
            startSession(state, status.sessionSeconds());
        }
    }

    private void recheckUnlocked(PlayerState state) {
        int epoch = state.epoch;
        core.api().post("check_status", identity(state)).thenAccept(result -> {
            synchronized (state) {
                boolean unlocked = state.status == Status.EXEMPT || state.status == Status.NOT_STAFF;
                if (!stale(state, epoch) && unlocked
                        && CheckStatus.from(result).decision() == CheckStatus.Decision.VERIFY) {
                    lockForFlow(state);
                    state.flowStarted = true;
                    requestToken(state);
                }
            }
        });
    }

    private void requestToken(PlayerState state) {
        if (core.isProxyMode()) { // el proxy da el enlace; aqui se espera a que verifique
            retryLater(state, POLL_MILLIS, Status.LOCKED, this::checkStatus);
            return;
        }
        int epoch = state.epoch;
        core.api().post("generate_token", identity(state)).thenAccept(result -> onToken(state, epoch, result));
    }

    private void onToken(PlayerState state, int epoch, ApiResult result) {
        synchronized (state) {
            if (stale(state, epoch) || state.status != Status.LOCKED) {
                return;
            }
            TokenGrant grant = TokenGrant.from(result);
            if (grant == null) { // fallo o not_in_whitelist: check_status vuelve a decidir
                retryLater(state, result, Status.LOCKED, this::checkStatus);
                return;
            }
            boolean fresh = !grant.token().equals(state.token);
            state.token = grant.token();
            state.verifyUrl = grant.verifyUrl();
            sendLink(state, "verification_required");
            if (fresh && !grant.existing() && core.settings().notifyAdmins()) {
                core.platform().broadcast(core.settings().adminPermission(),
                        core.messages().prefixed("admin_notification", "player", state.nick, "nick", state.nick));
            }
            startPolling(state);
        }
    }

    private void startPolling(PlayerState state) {
        if (state.poll == null) {
            state.poll = core.platform().repeat(() -> pollToken(state), POLL_MILLIS, POLL_MILLIS);
        }
    }

    /** Nunca lanza un sondeo mientras el anterior sigue en curso. */
    private void pollToken(PlayerState state) {
        String token;
        int epoch;
        synchronized (state) {
            if (stale(state, state.epoch) || state.token == null) {
                return;
            }
            token = state.token;
            epoch = state.epoch;
        }
        if (!state.pollInFlight.compareAndSet(false, true)) {
            return;
        }
        core.api().post("verify_token_status", Map.of("token", token)).thenAccept(result -> {
            state.pollInFlight.set(false);
            onTokenStatus(state, epoch, token, result);
        });
    }

    private void onTokenStatus(PlayerState state, int epoch, String token, ApiResult result) {
        synchronized (state) {
            TokenStatus status = TokenStatus.from(result);
            if (stale(state, epoch) || !token.equals(state.token) || status.state() == TokenStatus.State.PENDING) {
                return;
            }
            stopPolling(state);
            state.token = null;
            state.verifyUrl = null;
            boolean lockedFlow = state.status == Status.LOCKED;
            switch (status.state()) {
                case VERIFIED -> {
                    if (lockedFlow) {
                        state.status = Status.VERIFIED;
                        state.tokenRestarts = 0;
                        unlock(state);
                    }
                    core.platform().sendMessage(state.uuid, core.messages().prefixed("verification_success"));
                    startSession(state, status.sessionSeconds());
                }
                case EXPIRED -> {
                    if (lockedFlow) {
                        kickThenRecordFailure(state);
                    }
                }
                case NOT_FOUND -> {
                    if (lockedFlow && ++state.tokenRestarts > MAX_TOKEN_RESTARTS) {
                        kick(state, core.messages().get("kick_unverified"));
                    } else if (lockedFlow) {
                        checkStatus(state);
                    }
                }
                default -> {
                    // PENDING ya se descarto arriba
                }
            }
        }
    }

    /** C4: el bloqueo sigue hasta la desconexion; primero se expulsa y despues se registra el intento. */
    private void kickThenRecordFailure(PlayerState state) {
        cancelRetry(state);
        Map<String, String> identity = identity(state);
        Component reason = core.messages().get("kick_unverified");
        core.platform().runOnMain(() -> {
            core.platform().kick(state.uuid, reason);
            core.api().postOnce("record_failed_attempt", identity).thenAccept(result -> {
                if (result instanceof Success ok) {
                    core.logger().warn(state.nick + " no verifico a tiempo: intento fallido "
                            + Json.integer(ok.body(), "failed_attempts", 0)
                            + (Json.bool(ok.body(), "blacklisted", false) ? " (baneado automaticamente)" : ""));
                } else {
                    core.logger().warn("No se pudo registrar el intento fallido de " + state.nick + ": "
                            + Replies.describe(result));
                }
            });
        });
    }

    private void kick(PlayerState state, Component reason) {
        core.platform().runOnMain(() -> core.platform().kick(state.uuid, reason));
    }

    private void startSession(PlayerState state, long seconds) {
        if (seconds > 0) {
            sessions.start(state.uuid, seconds);
            return;
        }
        int epoch = state.epoch; // la respuesta no traia el tiempo: se pregunta
        core.api().post("get_session", Map.of("uuid", state.uuid.toString(), "ip", state.ip)).thenAccept(result -> {
            synchronized (state) {
                if (stale(state, epoch) || state.status != Status.VERIFIED) {
                    return;
                }
                long remaining = Replies.sessionSeconds(result);
                if (remaining < 0) {
                    retryLater(state, result, Status.VERIFIED, retry -> startSession(retry, -1));
                } else {
                    sessions.start(state.uuid, remaining); // 0: caduca ya y se pide un enlace
                }
            }
        });
    }

    private void sendReset(PlayerState state, Consumer<ApiResult> reply) {
        int epoch = state.epoch;
        core.api().post("reset_session", Map.of("uuid", state.uuid.toString(), "nick", state.nick)).thenAccept(result -> {
            reply.accept(result);
            synchronized (state) {
                if (stale(state, epoch) || state.status != Status.LOCKED) {
                    return;
                }
                if (result instanceof Success ok && Json.bool(ok.body(), "success", false)) {
                    state.resetPending = false;
                    requestToken(state);
                } else {
                    retryLater(state, result, Status.LOCKED, retry -> sendReset(retry, ignored -> { }));
                }
            }
        });
    }

    private void sendLink(PlayerState state, String headerKey) {
        Messages messages = core.messages();
        if (headerKey != null) {
            core.platform().sendMessage(state.uuid, messages.prefixed(headerKey));
        }
        String url = state.verifyUrl;
        Component link = messages.prefixed("verification_link", "url", url, "verify_url", url);
        core.platform().sendMessage(state.uuid, Messages.clickable(link, url));
    }

    private void retryLater(PlayerState state, ApiResult result, Status expected, Consumer<PlayerState> action) {
        if (!state.failureLogged && !(result instanceof Success)) {
            state.failureLogged = true;
            core.logger().warn("API no disponible para " + state.nick + " (" + Replies.describe(result)
                    + "): sigue bloqueado y se reintenta");
        }
        retryLater(state, Replies.retryDelayMillis(result), expected, action);
    }

    private void retryLater(PlayerState state, long delayMillis, Status expected, Consumer<PlayerState> action) {
        cancelRetry(state);
        int epoch = state.epoch;
        state.retryExpected = expected;
        state.retryAction = action;
        state.retry = core.platform().schedule(() -> {
            synchronized (state) {
                if (!stale(state, epoch) && state.status == expected) {
                    state.retry = null;
                    action.accept(state);
                }
            }
        }, delayMillis);
    }

    private boolean stale(PlayerState state, int epoch) {
        return closed || state.epoch != epoch || states.get(state.uuid) != state;
    }

    private void stopPolling(PlayerState state) {
        cancel(state.poll);
        state.poll = null;
    }

    private void cancelTasks(PlayerState state) {
        stopPolling(state);
        cancelRetry(state);
    }

    private static void cancelRetry(PlayerState state) {
        cancel(state.retry);
        state.retry = null;
        state.retryAction = null;
    }

    private static void cancel(TaskHandle task) {
        if (task != null) {
            task.cancel();
        }
    }

    private static Map<String, String> identity(PlayerState state) {
        return Map.of("uuid", state.uuid.toString(), "nick", state.nick, "ip", state.ip);
    }

    /** Estado mutable de un jugador conectado; se accede con {@code synchronized (state)}. */
    private static final class PlayerState {
        final UUID uuid;
        final String nick;
        final String ip;
        final Object handle;
        final AtomicBoolean pollInFlight = new AtomicBoolean();
        Status status = Status.UNCHECKED;
        int epoch;
        boolean tracked;
        boolean flowStarted;
        boolean resetPending;
        boolean failureLogged;
        int tokenRestarts;
        String token;
        String verifyUrl;
        TaskHandle poll;
        TaskHandle retry;
        Status retryExpected;
        Consumer<PlayerState> retryAction;

        PlayerState(PlayerInfo player) {
            this.uuid = player.uuid();
            this.nick = player.nick();
            this.ip = player.ip();
            this.handle = player.handle();
        }
    }
}
