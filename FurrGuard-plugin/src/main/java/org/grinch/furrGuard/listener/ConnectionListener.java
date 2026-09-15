package org.grinch.furrGuard.listener;

import com.velocitypowered.api.event.EventTask;
import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.ResultedEvent.ComponentResult;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.LoginEvent;
import com.velocitypowered.api.event.connection.PostLoginEvent;
import com.velocitypowered.api.proxy.Player;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.FurrGuard.State;
import org.grinch.furrGuard.api.CheckCache;
import org.grinch.furrGuard.api.CheckResult;
import org.grinch.furrGuard.api.LoginDecision;
import org.grinch.furrGuard.api.PluginApi;
import org.grinch.furrGuard.api.Reasons;
import org.grinch.furrGuard.config.PluginConfig;
import org.grinch.furrGuard.text.Messages;
import org.grinch.furrGuard.text.Placeholders;
import org.grinch.furrGuard.util.Players;
import org.grinch.furrguard.common.http.ApiResult;
import org.slf4j.Logger;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public final class ConnectionListener {

    /**
     * Conexion aceptada: la decision del login (para avisos y expulsiones) y el {@code player_join} en
     * curso, para que el {@code player_quit} nunca llegue antes que el join.
     */
    private record Session(Player player, CheckResult check, CompletableFuture<?> join) {
    }

    private static final CompletableFuture<?> DONE = CompletableFuture.completedFuture(null);

    private final FurrGuard plugin;
    private final Logger logger;
    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();
    private final Set<CompletableFuture<?>> pendingQuits = ConcurrentHashMap.newKeySet();

    public ConnectionListener(FurrGuard plugin) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
    }

    /** En LoginEvent ya hay UUID real (premium o no): el nick solo no identifica a nadie. */
    @Subscribe(order = PostOrder.EARLY)
    public EventTask onLogin(LoginEvent event) {
        if (!event.getResult().isAllowed()) {
            return null;
        }
        State state = plugin.state();
        Messages messages = plugin.messages();
        switch (state.readiness()) {
            case DISABLED:
                return null;
            case UNLICENSED:
                event.setResult(ComponentResult.denied(messages.render("kick_unlicensed",
                        Map.of("discord", state.config().licenseDiscordUrl()))));
                return null;
            case STARTING:
            case CONFIG_ERROR:
                event.setResult(ComponentResult.denied(messages.render("kick_starting", Map.of())));
                return null;
            default:
                break; // READY
        }

        Player player = event.getPlayer();
        PluginConfig config = state.config();
        String ip = Players.ip(player.getRemoteAddress());
        String cacheKey = CheckCache.key(player.getUniqueId(), player.getUsername(), ip);
        CheckResult cached = config.cacheEnabled() ? plugin.cache().get(cacheKey) : null;
        if (cached != null) {
            apply(event, player, ip, config, LoginDecision.of(cached));
            return null;
        }

        CompletableFuture<Void> check = state.api()
                .checkPlayer(player.getUniqueId(), player.getUsername(), ip, Players.gameVersion(player.getProtocolVersion()))
                .handle((result, error) -> {
                    try {
                        if (error != null) { // el cliente comun no deberia completar nunca con excepcion
                            throw new IllegalStateException("fallo inesperado del cliente HTTP", error);
                        }
                        LoginDecision decision = LoginDecision.of(result, config.failurePolicy());
                        CheckResult checked = decision instanceof LoginDecision.Allow allow ? allow.result()
                                : ((LoginDecision.Deny) decision).result();
                        if (checked != null && config.cacheEnabled()) {
                            plugin.cache().put(cacheKey, checked, config.cacheDuration());
                        }
                        apply(event, player, ip, config, decision);
                    } catch (RuntimeException e) { // nunca dejar pasar por un fallo propio
                        String reference = referenceId();
                        logger.error("Error inesperado verificando a {} [ref {}]: conexion denegada",
                                player.getUsername(), reference, e);
                        event.setResult(ComponentResult.denied(
                                plugin.messages().render("kick_unknown_error", Map.of("id", reference))));
                    }
                    return null;
                });
        return EventTask.resumeWhenComplete(check);
    }

    @Subscribe
    public void onPostLogin(PostLoginEvent event) {
        State state = plugin.state();
        PluginApi api = state.api();
        if (api == null || !state.config().enabled()) {
            return;
        }
        Player player = event.getPlayer();
        String ip = Players.ip(player.getRemoteAddress());
        CompletableFuture<?> join = api.playerJoin(player.getUniqueId(), player.getUsername(), ip)
                .thenAccept(result -> {
                    if (result instanceof ApiResult.Failure failure) {
                        logger.warn("player_join de {} fallo: {} {}", player.getUsername(), failure.kind(), failure.message());
                    }
                });
        Session session = sessions.compute(player.getUniqueId(), (uuid, current) ->
                new Session(player, current != null && current.player() == player ? current.check() : null, join));
        if (session.check() != null) {
            notifyJoin(state.config(), player, ip, session.check());
        }
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        Session session = sessions.get(uuid);
        CompletableFuture<?> join = DONE;
        if (session != null && session.player() == player) {
            sessions.remove(uuid, session);
            join = session.join();
        }
        DisconnectEvent.LoginStatus status = event.getLoginStatus();
        if (status != DisconnectEvent.LoginStatus.SUCCESSFUL_LOGIN && status != DisconnectEvent.LoginStatus.PRE_SERVER_JOIN) {
            return; // nunca llego a PostLogin (o es un login duplicado): no hubo player_join
        }
        State state = plugin.state();
        PluginApi api = state.api();
        if (api != null && state.config().enabled()) {
            CompletableFuture<ApiResult> quit = join.handle((ignored, error) -> null)
                    .thenCompose(ignored -> api.playerQuit(uuid));
            pendingQuits.add(quit);
            quit.whenComplete((result, error) -> pendingQuits.remove(quit));
        }
    }

    /** Se completa cuando terminan los player_quit en vuelo (al apagar, antes de cerrar el cliente). */
    public CompletableFuture<Void> pendingQuits() {
        return CompletableFuture.allOf(pendingQuits.toArray(CompletableFuture[]::new));
    }

    /** Decision del login de un jugador conectado, o null si no se comprobo (desactivado, failure-policy). */
    public CheckResult sessionCheck(Player player) {
        Session session = sessions.get(player.getUniqueId());
        return session != null && session.player() == player ? session.check() : null;
    }

    /** Sesiones de conexiones que ya no existen (p. ej. un login denegado por otro plugin tras el nuestro). */
    public void sweep() {
        sessions.values().removeIf(session -> !session.player().isActive());
    }

    private void apply(LoginEvent event, Player player, String ip, PluginConfig config, LoginDecision decision) {
        String nick = player.getUsername();
        if (decision instanceof LoginDecision.Allow allow) {
            if (allow.result() == null) {
                logger.warn("Login de {} desde {} permitido SIN comprobar (api.failure-policy: allow): {}",
                        nick, ip, allow.failure());
                return;
            }
            sessions.put(player.getUniqueId(), new Session(player, allow.result(), DONE));
            if (config.debug()) {
                logger.info("[DEBUG] Permitido {} desde {} ({})", nick, ip, allow.result().reason());
            }
            return;
        }

        LoginDecision.Deny deny = (LoginDecision.Deny) decision;
        String reference = referenceId();
        Messages messages = plugin.messages();
        if (deny.result() == null) {
            logger.warn("Login de {} desde {} denegado [ref {}]: {}", nick, ip, reference, deny.failure());
            event.setResult(ComponentResult.denied(messages.render(deny.messageKey(), Map.of("id", reference))));
            return;
        }
        CheckResult result = deny.result();
        Map<String, String> values = Placeholders.kick(nick, ip, result, reference, Instant.now());
        event.setResult(ComponentResult.denied(messages.render(deny.messageKey(), values)));
        logger.info("Bloqueado {} ({}) desde {} [ref {}]: {}", nick, player.getUniqueId(), ip, values.get("id"),
                result.reason());
        plugin.broadcastToAdmins(messages.prefixed(Reasons.notifyMessageKey(result.reason()),
                Placeholders.notice(nick, ip, result)));
    }

    private void notifyJoin(PluginConfig config, Player player, String ip, CheckResult check) {
        Messages messages = plugin.messages();
        boolean notifyAll = messages.settingEnabled("notify_connections");
        boolean notifyNonHispanic = messages.settingEnabled("notify_hispanic");
        String countryCode = check.ipData().countryCode();
        boolean hispanic = countryCode != null && config.hispanicCountries().contains(countryCode.toUpperCase(Locale.ROOT));
        if (notifyAll || (notifyNonHispanic && !hispanic)) {
            String key = hispanic ? "notify_player_join" : "notify_non_hispanic_join";
            plugin.broadcastToAdmins(messages.prefixed(key, Placeholders.notice(player.getUsername(), ip, check)));
        }
    }

    public static String referenceId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }
}
