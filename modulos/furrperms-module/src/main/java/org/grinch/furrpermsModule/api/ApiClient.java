package org.grinch.furrpermsModule.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.grinch.furrpermsModule.FurrpermsModule;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class ApiClient {

    private static final String API_URL = "https://furrguard.srteb.eu/api/plugin.php";
    private static final int API_TIMEOUT = 5000;

    private final FurrpermsModule plugin;

    // Caché simple de whitelist (nick -> boolean) con TTL de 30 segundos
    private final Map<String, Boolean> whitelistCache = new HashMap<>();
    private long cacheTime = 0;
    private static final long CACHE_TTL = 30000; // 30 segundos

    public ApiClient(FurrpermsModule plugin) {
        this.plugin = plugin;
    }

    /**
     * Verifica si un jugador puede ejecutar un comando sensible
     */
    public boolean checkCommand(String nick, String uuid, String command, String server) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("action", "check_furr_perms_whitelist");
            data.put("nick", nick);
            data.put("uuid", uuid != null ? uuid : "");

            JsonObject response = sendRequest(data);

            if (response != null && response.has("allowed")) {
                return response.get("allowed").getAsBoolean();
            }

            // Si hay error, denegar por defecto (fail-closed para mayor seguridad)
            return false;
        } catch (Exception e) {
            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().warn("[DEBUG] Error al verificar comando: " + e.getMessage());
            }
            // En caso de error, denegar (fail-closed)
            return false;
        }
    }

    /**
     * Verifica si un jugador está en whitelist de FurrPerms (con caché)
     */
    public boolean isInWhitelist(String nick, String uuid) {
        // Verificar caché
        long now = System.currentTimeMillis();
        if (now - cacheTime < CACHE_TTL && whitelistCache.containsKey(nick.toLowerCase())) {
            return whitelistCache.get(nick.toLowerCase());
        }

        // Cache expirado o no existe, consultar API
        try {
            Map<String, String> data = new HashMap<>();
            data.put("action", "check_furr_perms_whitelist");
            data.put("nick", nick);
            data.put("uuid", uuid != null ? uuid : "");

            JsonObject response = sendRequest(data);
            boolean allowed = response != null && response.has("allowed") && response.get("allowed").getAsBoolean();

            // Actualizar caché
            whitelistCache.clear();
            whitelistCache.put(nick.toLowerCase(), allowed);
            cacheTime = now;

            return allowed;
        } catch (Exception e) {
            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().warn("[DEBUG] Error al verificar whitelist: " + e.getMessage());
            }
            return false;
        }
    }

    /**
     * Notifica al API cuando un comando es ejecutado
     */
    public void logCommand(String nick, String uuid, String command, String server, boolean allowed, String reason) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("action", "log_furr_perms_command");
            data.put("player_nick", nick);
            data.put("player_uuid", uuid != null ? uuid : "");
            data.put("command", command);
            data.put("server_name", server != null ? server : "");
            data.put("allowed", allowed ? "1" : "0");
            data.put("reason", reason != null ? reason : "");

            sendRequest(data);
        } catch (Exception e) {
            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().warn("[DEBUG] Error al log comando: " + e.getMessage());
            }
        }
    }

    public Map<String, String> getMessages() {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("action", "get_messages");

            JsonObject response = sendRequest(data);
            if (response != null) {
                Map<String, String> messages = new HashMap<>();
                for (String key : response.keySet()) {
                    if (key.startsWith("fur_perms_")) {
                        messages.put(key, response.get(key).getAsString());
                    }
                }
                return messages;
            }
        } catch (Exception e) {
            plugin.getLogger().error("Error al obtener mensajes: " + e.getMessage());
        }
        return getDefaultMessages();
    }

    public void clearWhitelistCache() {
        whitelistCache.clear();
        cacheTime = 0;
    }

    private Map<String, String> getDefaultMessages() {
        Map<String, String> messages = new HashMap<>();
        messages.put("fur_perms_no_permission", "&c✘ &cNo tienes permiso para ejecutar este comando. Solo administradores autorizados pueden usar comandos de gestión de permisos.");
        messages.put("fur_perms_command_blocked", "&c✘ &cEl comando &f{command} &cestá restringido por FurrPerms. Solo usuarios autorizados pueden ejecutarlo.");
        messages.put("fur_perms_logged", "&c✘ &cTu intento de ejecutar &f{command} &cha sido registrado en los logs del sistema.");
        messages.put("fur_perms_notify_blocked", "&c⚠ &f{player} &7intentó ejecutar &f{command} &7en servidor &f{server}");
        messages.put("fur_perms_notify_allowed", "&a✔ &f{player} &7ejecutó &f{command} &7en servidor &f{server}");
        return messages;
    }

    private JsonObject sendRequest(Map<String, String> data) {
        HttpURLConnection connection = null;
        try {
            String urlWithAction = API_URL + "?action=" + URLEncoder.encode(data.get("action"), StandardCharsets.UTF_8);
            URL url = new URL(urlWithAction);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.setRequestProperty("User-Agent", "FurrPerms-Module/1.0");
            connection.setConnectTimeout(API_TIMEOUT);
            connection.setReadTimeout(API_TIMEOUT);
            connection.setDoOutput(true);
            connection.setInstanceFollowRedirects(false);

            String postData = data.entrySet().stream()
                    .filter(e -> !e.getKey().equals("action"))
                    .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                    .collect(Collectors.joining("&"));

            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().info("[DEBUG] API Request: " + data.get("action"));
            }

            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = postData.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = connection.getResponseCode();

            if (responseCode >= 300 && responseCode < 400) {
                plugin.getLogger().warn("[SECURITY] API devolvió una redirección (" + responseCode + "). Rechazada.");
                return null;
            }

            if (responseCode == 429) {
                plugin.getLogger().warn("[FG] API rate limited.");
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
                int maxResponseSize = 1024 * 256; // 256KB max
                while ((line = br.readLine()) != null) {
                    response.append(line);
                    if (response.length() > maxResponseSize) {
                        plugin.getLogger().warn("[SECURITY] Respuesta API excede el tamaño máximo. Truncada.");
                        break;
                    }
                }

                if (plugin.getConfig().isDebug()) {
                    plugin.getLogger().info("[DEBUG] API Response: " + response.toString().substring(0, Math.min(200, response.length())));
                }

                return JsonParser.parseString(response.toString()).getAsJsonObject();
            }

        } catch (Exception e) {
            if (plugin.getConfig().isDebug()) {
                plugin.getLogger().error("Error en petición API: " + e.getMessage());
            }
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}
