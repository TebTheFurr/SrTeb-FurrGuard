package org.grinch.furrGuard.sync;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.velocitypowered.api.proxy.Player;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.FurrGuard.Readiness;
import org.grinch.furrGuard.FurrGuard.State;
import org.grinch.furrGuard.api.CheckResult;
import org.grinch.furrGuard.api.PluginApi;
import org.grinch.furrGuard.api.Reasons;
import org.grinch.furrGuard.listener.ConnectionListener;
import org.grinch.furrGuard.text.Messages;
import org.grinch.furrGuard.text.Placeholders;
import org.grinch.furrGuard.util.Players;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.json.Json;
import org.slf4j.Logger;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cambios hechos desde el panel: {@code poll_changes} con {@code wait=0} cada {@code api.poll-interval}.
 * Al cambiar {@code cache_version} recarga mensajes y ajustes, avisa de las acciones nuevas y hace un
 * {@code recheck_players} con todos los conectados (docs/API.md §1.2).
 */
public final class ChangeWatcher {

    /** Ultima respuesta de poll_changes, para {@code /fg status}. */
    public record PollStatus(long atMillis, boolean ok, String detail) {
    }

    private static final int MAX_NOTICES = 5;

    private final FurrGuard plugin;
    private final ConnectionListener listener;
    private final Logger logger;
    private final AtomicBoolean polling = new AtomicBoolean();
    private volatile long lastVersion = -1;
    private volatile long lastActionId = -1;
    private volatile PollStatus lastPoll;

    public ChangeWatcher(FurrGuard plugin, ConnectionListener listener) {
        this.plugin = plugin;
        this.listener = listener;
        this.logger = plugin.getLogger();
    }

    public PollStatus lastPoll() {
        return lastPoll;
    }

    /** La siguiente respuesta vuelve a ser linea base: recarga mensajes y ajustes sin re-verificar a nadie. */
    public void reset() {
        lastVersion = -1;
    }

    /** Tarea periodica del scheduler. No bloquea: como mucho un poll en vuelo. */
    public void tick() {
        State state = plugin.state();
        if (state.readiness() != Readiness.READY || !polling.compareAndSet(false, true)) {
            return;
        }
        PluginApi api = state.api();
        api.pollChanges(lastVersion).whenComplete((result, error) -> {
            try {
                onPoll(api, result);
            } catch (RuntimeException e) {
                logger.error("Error procesando poll_changes", e);
            } finally {
                polling.set(false);
            }
        });
    }

    private void onPoll(PluginApi api, ApiResult result) {
        if (result instanceof ApiResult.Failure failure) {
            PollStatus previous = lastPoll;
            lastPoll = new PollStatus(System.currentTimeMillis(), false, failure.kind() + ": " + failure.message());
            if (previous == null || previous.ok()) { // un aviso por caida, no uno cada pocos segundos
                logger.warn("poll_changes fallo ({}: {}); los cambios del panel no llegaran hasta que responda",
                        failure.kind(), failure.message());
            }
            return;
        }
        JsonObject body = ((ApiResult.Success) result).body();
        long version = Json.longValue(body, "cache_version", -1);
        if (version < 0) {
            lastPoll = new PollStatus(System.currentTimeMillis(), false, "respuesta sin cache_version");
            return;
        }
        if (lastPoll != null && !lastPoll.ok()) {
            logger.info("poll_changes vuelve a responder");
        }
        lastPoll = new PollStatus(System.currentTimeMillis(), true, "cache_version " + version);
        JsonArray actions = Json.arr(body, "recent_actions");

        if (lastVersion < 0) { // arranque o recarga: linea base sin avisos ni expulsiones
            lastVersion = version;
            lastActionId = Math.max(lastActionId, maxActionId(actions));
            refresh(api);
            return;
        }
        if (version == lastVersion) {
            return;
        }
        lastVersion = version;
        logger.info("Cambios en el panel (cache_version {}): recargando y re-verificando a los conectados", version);
        plugin.cache().clear();
        refresh(api);
        notifyActions(actions);
        recheckOnline(api);
    }

    /** Recarga {@code get_messages} y {@code get_settings}; si fallan se conservan los anteriores. */
    public CompletableFuture<Void> refresh(PluginApi api) {
        Messages messages = plugin.messages();
        CompletableFuture<Void> loadMessages = api.getMessages().thenAccept(result -> {
            if (result instanceof ApiResult.Success ok) {
                messages.updateMessages(Json.stringMap(ok.body()));
                logger.info("Mensajes cargados desde la API: {}", messages.apiMessageCount());
            } else {
                ApiResult.Failure failure = (ApiResult.Failure) result;
                logger.warn("get_messages fallo ({}: {}); se mantienen los mensajes actuales",
                        failure.kind(), failure.message());
            }
        });
        CompletableFuture<Void> loadSettings = api.getSettings().thenAccept(result -> {
            if (result instanceof ApiResult.Success ok) {
                messages.updateSettings(Json.stringMap(ok.body()));
            } else {
                ApiResult.Failure failure = (ApiResult.Failure) result;
                logger.warn("get_settings fallo ({}: {}); se mantienen los ajustes actuales",
                        failure.kind(), failure.message());
            }
        });
        return CompletableFuture.allOf(loadMessages, loadSettings);
    }

    private void recheckOnline(PluginApi api) {
        List<Player> online = new ArrayList<>(plugin.getServer().getAllPlayers());
        // ponytail: >500 conectados son varias llamadas; el contrato limita cada una a 500
        for (int from = 0; from < online.size(); from += PluginApi.RECHECK_BATCH) {
            JsonArray players = new JsonArray();
            for (Player player : online.subList(from, Math.min(online.size(), from + PluginApi.RECHECK_BATCH))) {
                JsonObject entry = new JsonObject();
                entry.addProperty("uuid", player.getUniqueId().toString());
                entry.addProperty("nick", player.getUsername());
                entry.addProperty("ip", Players.ip(player.getRemoteAddress()));
                players.add(entry);
            }
            api.recheckPlayers(players).thenAccept(this::onRecheck);
        }
    }

    private void onRecheck(ApiResult result) {
        if (result instanceof ApiResult.Failure failure) {
            logger.warn("recheck_players fallo ({}: {}): no se expulsa a nadie", failure.kind(), failure.message());
            return;
        }
        for (JsonElement element : Json.arr(((ApiResult.Success) result).body(), "results")) {
            if (element.isJsonObject()) {
                kickIfBlocked(element.getAsJsonObject());
            }
        }
    }

    private void kickIfBlocked(JsonObject entry) {
        Optional<CheckResult> parsed = CheckResult.parse(entry);
        if (parsed.isEmpty() || parsed.get().allowed() || !Reasons.justifiesKick(parsed.get().reason())) {
            return; // nunca por ip_api_unavailable, errores o respuestas incompletas
        }
        Optional<Player> target = parseUuid(Json.str(entry, "uuid", null)).flatMap(plugin.getServer()::getPlayer);
        if (target.isEmpty()) {
            return;
        }
        Player player = target.get();
        CheckResult atLogin = listener.sessionCheck(player);
        CheckResult result = parsed.get().withIpData(atLogin == null ? null : atLogin.ipData());
        String ip = Players.ip(player.getRemoteAddress());
        Messages messages = plugin.messages();
        player.disconnect(messages.render(Reasons.kickMessageKey(result.reason()),
                Placeholders.kick(player.getUsername(), ip, result, ConnectionListener.referenceId(), Instant.now())));
        logger.info("Expulsado {} ({}) desde {}: {}", player.getUsername(), player.getUniqueId(), ip, result.reason());
        plugin.broadcastToAdmins(messages.prefixed("notify_player_kicked",
                Placeholders.notice(player.getUsername(), ip, result)));
    }

    private void notifyActions(JsonArray actions) {
        long baseline = lastActionId;
        List<JsonObject> fresh = new ArrayList<>();
        for (JsonElement element : actions) {
            if (element.isJsonObject() && Json.longValue(element.getAsJsonObject(), "id", -1) > baseline) {
                fresh.add(element.getAsJsonObject());
            }
        }
        lastActionId = Math.max(baseline, maxActionId(actions));
        fresh.sort(Comparator.comparingLong(action -> Json.longValue(action, "id", -1)));
        Messages messages = plugin.messages();
        for (JsonObject action : fresh.subList(Math.max(0, fresh.size() - MAX_NOTICES), fresh.size())) {
            ActionNotice.of(Json.str(action, "type", ""), Json.str(action, "action", ""), Json.str(action, "details", ""))
                    .ifPresent(notice -> plugin.broadcastToAdmins(
                            messages.prefixedTemplate(notice.template(messages), notice.values())));
        }
    }

    private static long maxActionId(JsonArray actions) {
        long max = -1;
        for (JsonElement element : actions) {
            if (element.isJsonObject()) {
                max = Math.max(max, Json.longValue(element.getAsJsonObject(), "id", -1));
            }
        }
        return max;
    }

    private static Optional<UUID> parseUuid(String raw) {
        try {
            return raw == null ? Optional.empty() : Optional.of(UUID.fromString(raw));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Aviso de una accion de whitelist/blacklist del panel ({@code details} = "tipo: valor"). */
    record ActionNotice(String messageKey, String from, String to, Map<String, String> values) {

        static Optional<ActionNotice> of(String type, String action, String details) {
            if (!type.equals("whitelist") && !type.equals("blacklist")) {
                return Optional.empty(); // §1.2: recent_actions solo trae estos dos tipos
            }
            String[] parts = details.split("[:=]", 2);
            Map<String, String> values = parts.length == 2
                    ? Map.of("type", parts[0].trim(), "value", parts[1].trim())
                    : Map.of("type", "valor", "value", details.trim());
            String added = type + "_added";
            String removed = type + "_removed";
            ActionNotice notice = switch (action) {
                case "remove" -> new ActionNotice(removed, null, null, values);
                case "edit" -> new ActionNotice(added, "añadida", "editada", values);
                case "enable" -> new ActionNotice(added, "añadida", "activada", values);
                case "disable" -> new ActionNotice(removed, "eliminada", "desactivada", values);
                default -> new ActionNotice(added, null, null, values);
            };
            return Optional.of(notice);
        }

        /** El texto del panel con el verbo cambiado (la plantilla es de confianza, los valores no). */
        String template(Messages messages) {
            String template = messages.template(messageKey);
            return from == null ? template : template.replace(from, to);
        }
    }
}
