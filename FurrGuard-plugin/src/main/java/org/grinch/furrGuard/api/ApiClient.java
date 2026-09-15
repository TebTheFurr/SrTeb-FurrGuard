package org.grinch.furrGuard.api;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.api.response.CheckPlayerResponse;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.stream.Collectors;

public class ApiClient {

    private final FurrGuard plugin;
    private final Gson gson;
    private final Map<String, CachedResult> cache;
    private final Map<String, CheckPlayerResponse> preLoginDataCache = new ConcurrentHashMap<>();
    private volatile int lastCacheVersion = -1;
    private volatile int lastActivityId = -1;
    private volatile boolean running = true;
    private Thread longPollThread;

    public ApiClient(FurrGuard plugin) {
        this.plugin = plugin;
        this.gson = new Gson();
        this.cache = new ConcurrentHashMap<>();
        startLongPollWatcher();
    }

    private void startLongPollWatcher() {
        longPollThread = new Thread(() -> {
            // Initial delay before first poll
            try {
                Thread.sleep(10000);
            } catch (InterruptedException e) {
                return;
            }

            while (running) {
                try {
                    Map<String, String> data = new HashMap<>();
                    data.put("last_version", String.valueOf(lastCacheVersion));

                    JsonObject response = sendRequest("poll_changes", data, 30000);

                    if (response != null) {
                        if (response.has("cache_version")) {
                            int version = response.get("cache_version").getAsInt();
                            boolean changed = response.has("changed") && response.get("changed").getAsBoolean();

                            // Initialize lastActivityId on first successful poll
                            if (lastActivityId == -1) {
                                initLastActivityId(response);
                                plugin.getLogger().info("[FG] Activity ID inicializado: " + lastActivityId);
                            }

                            if (changed && lastCacheVersion >= 0) {
                                cache.clear();
                                plugin.getLogger().info("[FG] Cambio detectado desde panel web (v" + lastCacheVersion + " -> v" + version + ")");
                                // Reload messages and settings from API
                                try {
                                    plugin.getMessageUtil().loadMessages();
                                } catch (Exception e) {
                                    plugin.getLogger().warn("[FG] Error al recargar mensajes: " + e.getMessage());
                                }
                                // Notify admins with specific action messages
                                notifyRecentActions(response);
                                recheckOnlinePlayers();
                            }
                            lastCacheVersion = version;
                        }

                        // Re-poll immediately (no sleep)
                    } else {
                        plugin.getLogger().warn("[FG] Long poll devolvió null, reintentando...");
                        Thread.sleep(5000);
                    }
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    plugin.getLogger().error("[FG] Error en long poll: " + e.getMessage());
                    try {
                        Thread.sleep(5000);
                    } catch (InterruptedException ie) {
                        break;
                    }
                }
            }
        }, "FurrGuard-LongPoll");
        longPollThread.setDaemon(true);
        longPollThread.start();
    }

    private void initLastActivityId(JsonObject response) {
        if (response.has("recent_actions") && !response.get("recent_actions").isJsonNull()) {
            JsonArray actions = response.getAsJsonArray("recent_actions");
            int maxId = 0;
            for (int i = 0; i < actions.size(); i++) {
                JsonElement elem = actions.get(i);
                if (elem.isJsonObject()) {
                    int id = elem.getAsJsonObject().has("id") ? elem.getAsJsonObject().get("id").getAsInt() : 0;
                    if (id > maxId) maxId = id;
                }
            }
            lastActivityId = maxId;
        } else {
            lastActivityId = 0;
        }
    }

    private void notifyRecentActions(JsonObject response) {
        if (!response.has("recent_actions") || response.get("recent_actions").isJsonNull()) {
            return;
        }
        JsonArray actions = response.getAsJsonArray("recent_actions");

        boolean isFirstTime = (lastActivityId == -1);

        // Find max ID and collect new actions
        java.util.List<JsonObject> newActions = new java.util.ArrayList<>();
        int maxId = lastActivityId;

        for (int i = 0; i < actions.size(); i++) {
            JsonElement elem = actions.get(i);
            if (!elem.isJsonObject()) continue;
            JsonObject action = elem.getAsJsonObject();
            int id = action.has("id") ? action.get("id").getAsInt() : 0;
            if (id > maxId) maxId = id;
            if (!isFirstTime && id > lastActivityId) {
                newActions.add(action);
            }
        }

        // Update last seen ID
        lastActivityId = maxId;

        // On first detection, just store the ID without notifying (avoid old actions)
        if (isFirstTime) {
            plugin.getLogger().info("[FG] Primera detección, inicializando activity ID: " + lastActivityId);
            return;
        }
        if (newActions.isEmpty()) {
            plugin.getLogger().info("[FG] No hay acciones nuevas (lastActivityId=" + lastActivityId + ")");
            return;
        }
        plugin.getLogger().info("[FG] " + newActions.size() + " acciones nuevas detectadas");

        // Reverse to show in chronological order (oldest first), limit to 5
        java.util.Collections.reverse(newActions);
        int limit = Math.min(newActions.size(), 5);
        for (int i = 0; i < limit; i++) {
            JsonObject action = newActions.get(i);
            String type = action.has("type") ? action.get("type").getAsString() : "";
            String act = action.has("action") ? action.get("action").getAsString() : "";
            String details = action.has("details") && !action.get("details").isJsonNull() ? action.get("details").getAsString() : "";

            String msg = formatActionMessage(type, act, details);
            if (msg != null) {
                plugin.broadcastToAdmins(msg);
            }
        }
    }

    private String formatActionMessage(String type, String action, String details) {
        return switch (type) {
            case "blacklist" -> switch (action) {
                case "add" -> parseMessageFromKey("blacklist_added", details);
                case "remove" -> parseMessageFromKey("blacklist_removed", details);
                case "edit" -> parseMessageFromKey("blacklist_added", details).replace("añadida", "editada").replace("added", "edited");
                case "enable" -> parseMessageFromKey("blacklist_added", details).replace("añadida", "activada").replace("added", "enabled");
                case "disable" -> parseMessageFromKey("blacklist_removed", details).replace("eliminada", "desactivada").replace("removed", "disabled");
                default -> parseMessageFromKey("blacklist_added", details);
            };
            case "whitelist" -> switch (action) {
                case "add" -> parseMessageFromKey("whitelist_added", details);
                case "remove" -> parseMessageFromKey("whitelist_removed", details);
                case "edit" -> parseMessageFromKey("whitelist_added", details).replace("añadida", "editada").replace("added", "edited");
                case "enable" -> parseMessageFromKey("whitelist_added", details).replace("añadida", "activada").replace("added", "enabled");
                case "disable" -> parseMessageFromKey("whitelist_removed", details).replace("eliminada", "desactivada").replace("removed", "disabled");
                default -> parseMessageFromKey("whitelist_added", details);
            };
            case "settings" -> "&e⚙ &7Configuración actualizada desde el &fpanel web";
            case "providers" -> "&e⚠ &7Proveedores bloqueados actualizados desde el &fpanel web &8(" + details + ")";
            default -> null;
        };
    }

    private String parseMessageFromKey(String messageKey, String details) {
        String message = plugin.getMessageUtil().getMessage(messageKey);
        // Parse details format: "type:value" or "type=value" or just "value"
        String[] parts = details.split("[:=]", 2);
        if (parts.length >= 2) {
            message = message.replace("{type}", parts[0].trim())
                            .replace("{value}", parts[1].trim());
        } else {
            // If no separator found, use entire details as value
            message = message.replace("{value}", details.trim())
                            .replace("{type}", "valor");
        }
        return message;
    }

    private void recheckOnlinePlayers() {
        for (com.velocitypowered.api.proxy.Player player : plugin.getServer().getAllPlayers()) {
            String ip = player.getRemoteAddress().getAddress().getHostAddress();
            String nick = player.getUsername();
            java.util.UUID uuid = player.getUniqueId();

            CompletableFuture.runAsync(() -> {
                try {
                    Map<String, String> data = new HashMap<>();
                    data.put("uuid", uuid.toString());
                    data.put("nick", nick);
                    data.put("ip", ip);
                    data.put("game_version", "");

                    JsonObject response = sendRequest("check_player", data);
                    if (response != null && !response.has("error")) {
                        boolean allowed = response.has("allowed") && response.get("allowed").getAsBoolean();
                        if (!allowed) {
                            String reason = response.has("reason") ? response.get("reason").getAsString() : "blocked";
                            String kickMsg;
                            if ("blacklisted".equals(reason)) {
                                String blockReason = response.has("block_reason") ? response.get("block_reason").getAsString() : "Sin especificar";
                                String expiresAt = response.has("expires_at") && !response.get("expires_at").isJsonNull() ? response.get("expires_at").getAsString() : null;
                                String banId = response.has("ban_id") && !response.get("ban_id").isJsonNull() ? response.get("ban_id").getAsString() : java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
                                String timeRemaining = expiresAt != null ? " temporalmente" : " permanente";
                                kickMsg = plugin.getMessageUtil().getMessage("kick_blacklisted")
                                        .replace("{reason}", blockReason)
                                        .replace("{time_remaining}", timeRemaining)
                                        .replace("{id}", banId);
                            } else {
                                String id = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
                                kickMsg = plugin.getMessageUtil().getMessage("kick_default")
                                        .replace("{id}", id);
                            }
                            kickMsg = plugin.getMessageUtil().applyGlobalPlaceholders(kickMsg);
                            player.disconnect(plugin.getMessageUtil().parseMessage(kickMsg));
                            plugin.getLogger().info("Expulsado " + nick + " por cambio en blacklist/whitelist");

                            // Notify online admins
                            String reasonLabel = switch (reason) {
                                case "blacklisted" -> "Blacklist";
                                case "proxy_detected" -> "Proxy";
                                case "vpn_detected" -> "VPN";
                                case "hosting_detected" -> "Hosting";
                                case "mobile_detected" -> "Red movil";
                                case "blocked_provider" -> "Proveedor bloqueado";
                                default -> reason;
                            };
                            plugin.broadcastToAdmins("&c✘ &c" + nick + " &7expulsado desde &f" + ip + " &7(" + reasonLabel + ")");
                        }
                    }
                } catch (Exception e) {
                    plugin.getLogger().error("Error crítico al re-verificar " + nick + ": " + e.getClass().getName() + ": " + e.getMessage());
                    if (plugin.getConfig().isDebug()) {
                        plugin.getLogger().error("Stack trace:", e);
                    }
                }
            });
        }
    }

    public void shutdown() {
        running = false;
        if (longPollThread != null) {
            longPollThread.interrupt();
        }
    }

    public boolean testConnection() {
        try {
            JsonObject response = sendRequest("get_settings", new HashMap<>());
            return response != null;
        } catch (Exception e) {
            plugin.getLogger().error("Error en test de conexión: " + e.getMessage());
            return false;
        }
    }

    public CompletableFuture<CheckPlayerResponse> checkPlayer(UUID uuid, String nick, String ip, String gameVersion) {
        return CompletableFuture.supplyAsync(() -> {
            String cacheKey = (uuid != null ? uuid.toString() : nick) + "-" + ip;

            if (plugin.getConfig().isCacheEnabled()) {
                CachedResult cached = cache.get(cacheKey);
                if (cached != null && !cached.isExpired()) {
                    if (plugin.getConfig().isDebug()) {
                        plugin.getLogger().info("[DEBUG] Usando cache para " + nick);
                    }
                    return cached.getResponse();
                }
            }

            try {
                Map<String, String> data = new HashMap<>();
                data.put("uuid", uuid != null ? uuid.toString() : "");
                data.put("nick", nick);
                data.put("ip", ip);
                data.put("game_version", gameVersion);

                JsonObject response = sendRequest("check_player", data);

                if (response == null) {
                    plugin.getLogger().error("Respuesta nula de la API al verificar jugador");
                    return CheckPlayerResponse.error("api_unavailable", "No se pudo conectar con la API", false);
                }

                CheckPlayerResponse result = parseCheckPlayerResponse(response);

                if (plugin.getConfig().isCacheEnabled()) {
                    cache.put(cacheKey, new CachedResult(result, plugin.getConfig().getCacheDuration()));
                }

                return result;

            } catch (Exception e) {
                plugin.getLogger().error("Error al verificar jugador: " + e.getMessage());
                return CheckPlayerResponse.error("Error interno: " + e.getMessage());
            }
        });
    }

    public CompletableFuture<JsonObject> lookupPlayer(String nick) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, String> data = new HashMap<>();
                data.put("nick", nick);
                return sendRequest("lookup_player", data);
            } catch (Exception e) {
                plugin.getLogger().error("Error al buscar jugador: " + e.getMessage());
                return null;
            }
        });
    }

    public void notifyPlayerJoin(UUID uuid, String nick, String ip) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, String> data = new HashMap<>();
                data.put("uuid", uuid.toString());
                data.put("nick", nick);
                data.put("ip", ip);
                JsonObject response = sendRequest("player_join", data);

                if (response == null || !response.has("success")) {
                    plugin.getLogger().error("Error al notificar join de " + nick + ": respuesta inválida de la API");
                    // Could add to a retry queue here
                }
            } catch (Exception e) {
                plugin.getLogger().error("Error al notificar join de " + nick + ": " + e.getClass().getName() + ": " + e.getMessage());
                // Queue for retry
                // plugin.getFailedEventQueue().add(new FailedEvent("join", uuid, nick, ip));
            }
        });
    }

    public void notifyPlayerQuit(UUID uuid) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, String> data = new HashMap<>();
                data.put("uuid", uuid.toString());
                JsonObject response = sendRequest("player_quit", data);

                if (response == null || !response.has("success")) {
                    plugin.getLogger().error("Error al notificar quit: respuesta inválida de la API");
                    // Could add to a retry queue here
                }
            } catch (Exception e) {
                plugin.getLogger().error("Error al notificar quit: " + e.getClass().getName() + ": " + e.getMessage());
                // Queue for retry
                // plugin.getFailedEventQueue().add(new FailedEvent("quit", uuid, null, null));
            }
        });
    }

    public Map<String, String> getMessages() {
        try {
            JsonObject response = sendRequest("get_messages", new HashMap<>());
            if (response != null) {
                Map<String, String> messages = new HashMap<>();
                for (String key : response.keySet()) {
                    messages.put(key, response.get(key).getAsString());
                }
                return messages;
            }
        } catch (Exception e) {
            plugin.getLogger().error("Error al obtener mensajes: " + e.getMessage());
        }
        return new HashMap<>();
    }

    public Map<String, String> getSettings() {
        try {
            JsonObject response = sendRequest("get_settings", new HashMap<>());
            if (response != null) {
                Map<String, String> settings = new HashMap<>();
                for (String key : response.keySet()) {
                    settings.put(key, response.get(key).getAsString());
                }
                return settings;
            }
        } catch (Exception e) {
            plugin.getLogger().error("Error al obtener settings: " + e.getMessage());
        }
        return new HashMap<>();
    }

    private JsonObject sendRequest(String action, Map<String, String> data) {
        return sendRequest(action, data, plugin.getConfig().getApiTimeout());
    }

    private JsonObject sendRequest(String action, Map<String, String> data, int readTimeout) {
        HttpURLConnection connection = null;
        try {
            String apiUrl = plugin.getConfig().getApiUrl();

            // Warn if not using HTTPS
            if (apiUrl != null && apiUrl.startsWith("http://")) {
                if (plugin.getConfig().isDebug()) {
                    plugin.getLogger().warn("[SECURITY] La conexion API no usa HTTPS. Se recomienda usar HTTPS.");
                }
            }

            String urlWithAction = apiUrl + "?action=" + URLEncoder.encode(action, StandardCharsets.UTF_8);
            URL url = new URL(urlWithAction);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.setRequestProperty("X-API-Key", plugin.getConfig().getApiKey());
            connection.setRequestProperty("User-Agent", "FurrGuard-Plugin/1.0");
            connection.setConnectTimeout(plugin.getConfig().getApiTimeout());
            connection.setReadTimeout(readTimeout);
            connection.setDoOutput(true);
            connection.setInstanceFollowRedirects(false); // Prevent redirect attacks

            String postData = data.entrySet().stream()
                    .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                    .collect(Collectors.joining("&"));

            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().info("[DEBUG] API Request: " + action);
            }

            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = postData.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = connection.getResponseCode();

            // Reject redirects (potential SSRF)
            if (responseCode >= 300 && responseCode < 400) {
                plugin.getLogger().warn("[SECURITY] API devolvió una redirección (" + responseCode + "). Rechazada.");
                return null;
            }

            // Rate limited
            if (responseCode == 429) {
                plugin.getLogger().warn("[FG] API rate limited. Reduciendo frecuencia de peticiones.");
                return null;
            }

            InputStream inputStream = responseCode >= 400
                    ? connection.getErrorStream()
                    : connection.getInputStream();

            if (inputStream == null) {
                return null;
            }

            try (BufferedReader br = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String line;
                int maxResponseSize = 1024 * 512; // 512KB max
                while ((line = br.readLine()) != null) {
                    response.append(line);
                    if (response.length() > maxResponseSize) {
                        plugin.getLogger().warn("[SECURITY] Respuesta API excede el tamaño máximo. Truncada.");
                        break;
                    }
                }

                String responseStr = response.toString();
                if (plugin.getConfig().isDebug()) {
                    plugin.getLogger().info("[DEBUG] API Response [" + action + "]: " + responseStr.substring(0, Math.min(500, responseStr.length())));
                }

                return JsonParser.parseString(responseStr).getAsJsonObject();
            }

        } catch (java.net.SocketTimeoutException e) {
            if (!"poll_changes".equals(action)) {
                plugin.getLogger().error("Timeout en petición API [action=" + action + "]: " + e.getMessage());
            }
            // For critical operations, this will be handled as an error response
            return null;
        } catch (java.io.IOException e) {
            if (!"poll_changes".equals(action)) {
                plugin.getLogger().error("Error de E/S en petición API [action=" + action + "]: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            // Network errors - return null to be handled as error response
            return null;
        } catch (com.google.gson.JsonSyntaxException e) {
            plugin.getLogger().error("Error JSON en petición API [action=" + action + "]: " + e.getMessage());
            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().error("Stack trace:", e);
            }
            return null;
        } catch (Exception e) {
            if (!"poll_changes".equals(action)) {
                plugin.getLogger().error("Error inesperado en petición API [action=" + action + "]: " + e.getClass().getName() + ": " + e.getMessage());
                if (plugin.getConfig().isDebug()) {
                    plugin.getLogger().error("Stack trace:", e);
                }
            }
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private CheckPlayerResponse parseCheckPlayerResponse(JsonObject response) {
        CheckPlayerResponse result = new CheckPlayerResponse();

        if (response.has("error")) {
            result.setSuccess(false);
            result.setError(response.get("error").getAsString());
            result.setAllowed(true);
            return result;
        }

        result.setSuccess(true);
        result.setAllowed(response.has("allowed") && response.get("allowed").getAsBoolean());
        result.setReason(response.has("reason") ? response.get("reason").getAsString() : null);
        result.setBlockReason(response.has("block_reason") ? response.get("block_reason").getAsString() : null);
        result.setBlockType(response.has("block_type") ? response.get("block_type").getAsString() : null);
        result.setExpiresAt(response.has("expires_at") && !response.get("expires_at").isJsonNull() ? response.get("expires_at").getAsString() : null);
        result.setBanId(response.has("ban_id") && !response.get("ban_id").isJsonNull() ? response.get("ban_id").getAsString() : null);

        if (response.has("ip_data") && !response.get("ip_data").isJsonNull()) {
            JsonObject ipData = response.getAsJsonObject("ip_data");
            result.setCountry(ipData.has("country") ? ipData.get("country").getAsString() : null);
            result.setCountryCode(ipData.has("countryCode") ? ipData.get("countryCode").getAsString() : null);
            result.setIsp(ipData.has("isp") ? ipData.get("isp").getAsString() : null);
            result.setOrg(ipData.has("org") ? ipData.get("org").getAsString() : null);
            result.setAsn(ipData.has("as") ? ipData.get("as").getAsString() : null);
            result.setProxy(ipData.has("proxy") && ipData.get("proxy").getAsBoolean());
            result.setHosting(ipData.has("hosting") && ipData.get("hosting").getAsBoolean());
            result.setMobile(ipData.has("mobile") && ipData.get("mobile").getAsBoolean());
        }

        return result;
    }

    public void storePreLoginData(String username, CheckPlayerResponse response) {
        preLoginDataCache.put(username.toLowerCase(), response);
    }

    public CheckPlayerResponse consumePreLoginData(String username) {
        return preLoginDataCache.remove(username.toLowerCase());
    }

    public void clearCache() {
        cache.clear();
    }

    private static class CachedResult {
        private final CheckPlayerResponse response;
        private final long expiresAt;

        public CachedResult(CheckPlayerResponse response, int durationSeconds) {
            this.response = response;
            this.expiresAt = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(durationSeconds);
        }

        public boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }

        public CheckPlayerResponse getResponse() {
            return response;
        }
    }
}
