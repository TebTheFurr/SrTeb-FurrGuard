package org.grinch.furrGuard.api;

import com.google.gson.JsonArray;
import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiClientConfig;
import org.grinch.furrguard.common.http.ApiResult;
import org.slf4j.Logger;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Acciones de {@code api/plugin.php} que usa el proxy (docs/API.md §1.2) sobre el {@link ApiClient} comun.
 * Los futuros nunca fallan con excepcion. En debug solo se registra accion, estado y tiempo: nunca
 * cuerpos ni la clave.
 */
public final class PluginApi implements AutoCloseable {

    /** Tope de {@code recheck_players} por llamada (§1.2). */
    public static final int RECHECK_BATCH = 500;

    private final ApiClient client;
    private final ApiClientConfig config;
    private final boolean debug;
    private final Logger logger;

    public PluginApi(ApiClientConfig config, boolean debug, Logger logger) {
        this.client = new ApiClient(config);
        this.config = config;
        this.debug = debug;
        this.logger = logger;
    }

    public ApiClientConfig config() {
        return config;
    }

    public CompletableFuture<ApiResult> checkPlayer(UUID uuid, String nick, String ip, String gameVersion) {
        return call("check_player", Map.of("uuid", uuid.toString(), "nick", nick, "ip", ip, "game_version", gameVersion));
    }

    /** {@code players}: {@code [{"uuid","nick","ip"}]}, como mucho {@link #RECHECK_BATCH}. */
    public CompletableFuture<ApiResult> recheckPlayers(JsonArray players) {
        return call("recheck_players", Map.of("players", players.toString()));
    }

    public CompletableFuture<ApiResult> lookupPlayer(String nick) {
        return call("lookup_player", Map.of("nick", nick));
    }

    public CompletableFuture<ApiResult> playerJoin(UUID uuid, String nick, String ip) {
        return call("player_join", Map.of("uuid", uuid.toString(), "nick", nick, "ip", ip));
    }

    public CompletableFuture<ApiResult> playerQuit(UUID uuid) {
        return call("player_quit", Map.of("uuid", uuid.toString()));
    }

    public CompletableFuture<ApiResult> getMessages() {
        return call("get_messages", Map.of());
    }

    public CompletableFuture<ApiResult> getSettings() {
        return call("get_settings", Map.of());
    }

    /** Sin espera en el servidor ({@code wait=0}): el plugin sondea cada {@code api.poll-interval}. */
    public CompletableFuture<ApiResult> pollChanges(long lastVersion) {
        return call("poll_changes", Map.of("last_version", Long.toString(lastVersion), "wait", "0"));
    }

    @Override
    public void close() {
        client.close();
    }

    private CompletableFuture<ApiResult> call(String action, Map<String, String> form) {
        long start = System.nanoTime();
        CompletableFuture<ApiResult> future = client.post(action, form);
        if (debug) {
            future.thenAccept(result -> logger.info("[DEBUG] API {} -> {} ({} ms)", action, describe(result),
                    TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)));
        }
        return future;
    }

    private static String describe(ApiResult result) {
        if (result instanceof ApiResult.Success ok) {
            return "HTTP " + ok.status();
        }
        ApiResult.Failure failure = (ApiResult.Failure) result;
        return failure.kind() + (failure.status() > 0 ? " HTTP " + failure.status() : "");
    }
}
