package org.grinch.furrGuard.license;

import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import org.grinch.furrGuard.FurrGuard;
import org.slf4j.Logger;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Sistema de Licencias FurrDownloads para FurrGuard
 * Basado en OAuth2 con código de vinculación
 */
public class LicenseManager {

    // ============================================
    // CONFIGURACIÓN HARDCODEADA - NO CAMBIAR
    // ============================================

    /**
     * ID del plugin HARDCODEADO
     * Debe coincidir con el plugin_id creado en el panel web
     */
    private static final String PLUGIN_ID = "furrguard";

    /**
     * Versión del plugin HARDCODEADA
     * ¡ACTUALIZAR ESTE VALOR CON CADA NUEVA VERSIÓN!
     */
    private static final String PLUGIN_VERSION = "1.0.2";

    /**
     * URL de la API HARCODEADA
     */
    private static final String API_URL = "https://furrdownloads.srteb.eu/api";

    // ============================================
    // VARIABLES DE INSTANCIA
    // ============================================

    private final FurrGuard plugin;
    private final Logger logger;
    private final ProxyServer server;
    private final Path dataDirectory;

    private String encryptedApiKey;
    private String instanceId;
    private LicenseInfo licenseInfo;
    private boolean licensed = false;
    private ScheduledTask heartbeatTask;
    private UpdateInfo availableUpdate;
    private final List<Runnable> licenseValidCallbacks = new ArrayList<>();

    public LicenseManager(FurrGuard plugin, Logger logger, ProxyServer server, Path dataDirectory) {
        this.plugin = plugin;
        this.logger = logger;
        this.server = server;
        this.dataDirectory = dataDirectory;
    }

    // ============================================
    // SISTEMA DE LICENCIAS (NUEVO FLUJO OAUTH)
    // ============================================

    /**
     * Verifica la licencia del plugin
     */
    public void verifyLicense() {
        logger.info("Verificando licencia...");

        // Leer archivo key si existe
        Path keyFile = dataDirectory.resolve("key");
        if (Files.exists(keyFile)) {
            String keyContent = readKeyFile(keyFile);
            if (keyContent != null && !keyContent.isEmpty()) {
                String hwid = generateHWID();

                CompletableFuture.supplyAsync(() -> {
                    try {
                        return verifyApiKey(keyContent, hwid);
                    } catch (Exception e) {
                        logger.error("Error al verificar licencia: " + e.getMessage());
                        return new LicenseResponse();
                    }
                }).thenAccept(response -> {
                    if (response.success) {
                        this.licenseInfo = response.license;
                        this.licensed = true;
                        this.instanceId = response.instance_id;
                        this.encryptedApiKey = keyContent;

                        showLicenseSuccess(response);
                        enablePluginFeatures();
                    } else {
                        try {
                            Files.deleteIfExists(keyFile);
                            logger.warn("API key inválida. Iniciando nuevo flujo de vinculación.");
                            initiateLinkingFlow();
                        } catch (IOException e) {
                            logger.error("Error al borrar archivo key: " + e.getMessage());
                        }
                    }
                });
                return;
            }
        }

        // No hay archivo key, iniciar flujo de vinculación
        initiateLinkingFlow();
    }

    /**
     * Inicia el flujo de vinculación OAuth
     */
    private void initiateLinkingFlow() {
        String hwid = generateHWID();

        // Recopilar información del servidor
        Map<String, String> serverInfo = new HashMap<>();
        serverInfo.put("name", "FurrGuard");
        serverInfo.put("version", PLUGIN_VERSION);
        serverInfo.put("platform", "velocity");
        serverInfo.put("port", String.valueOf(server.getBoundAddress().getPort()));

        CompletableFuture.supplyAsync(() -> {
            try {
                return initiateLinking(hwid, serverInfo);
            } catch (Exception e) {
                logger.error("Error al iniciar vinculación: " + e.getMessage());
                return new LinkingResponse();
            }
        }).thenAccept(response -> {
            if (response.success) {
                showLinkingInstructions(response);
                startPollingForCompletion(response.link_code);
            } else {
                logger.error("Error al iniciar vinculación: " + response.error);
            }
        });
    }

    /**
     * Muestra instrucciones de vinculación en consola
     */
    private void showLinkingInstructions(LinkingResponse response) {
        logger.info("╔═══════════════════════════════════════════════════════════════════════╗");
        logger.info("║  INICIALIZACIÓN REQUERIDA - VERIFICACIÓN DISCORD                     ║");
        logger.info("╠═══════════════════════════════════════════════════════════════════════╣");
        logger.info("║  Este servidor necesita verificación con Discord.                     ║");
        logger.info("║  ¡La sesión expira en 5 minutos!                                      ║");
        logger.info("║                                                                        ║");
        logger.info("║  Código de vinculación: " + String.format("%-43s", response.link_code) + "║");
        logger.info("║                                                                        ║");
        logger.info("║  Abre este enlace en tu navegador:                                    ║");
        logger.info("║  " + String.format("%-63s", getLinkUrl(response.link_code)) + "║");
        logger.info("║                                                                        ║");
        logger.info("║  O escanea este código QR:                                             ║");
        logger.info("║  " + String.format("%-63s", "[QR: " + getQrCodeUrl(response.link_code) + "]") + "║");
        logger.info("║                                                                        ║");
        logger.info("║  Esperando vinculación...                                             ║");
        logger.info("╚═══════════════════════════════════════════════════════════════════════╝");
    }

    /**
     * Inicia el polling para verificar si la vinculación se completó
     */
    private void startPollingForCompletion(String linkCode) {
        final int[] attempts = {0};
        final int maxAttempts = 30; // 30 intentos = 5 minutos

        Runnable pollTask = new Runnable() {
            @Override
            public void run() {
                if (licensed) {
                    return; // Ya está licenciado
                }

                if (attempts[0] >= maxAttempts) {
                    logger.error("╔═══════════════════════════════════════════════════════════════════════╗");
                    logger.error("║  TIEMPO DE ESPERA AGOTADO (5 MINUTOS)                                ║");
                    logger.error("╠═══════════════════════════════════════════════════════════════════════╣");
                    logger.error("║  La sesión de vinculación ha expirado.                                ║");
                    logger.error("║  Reinicia el servidor para generar un nuevo código.                     ║");
                    logger.error("╚═══════════════════════════════════════════════════════════════════════╝");
                    return;
                }

                attempts[0]++;

                CompletableFuture.supplyAsync(() -> {
                    try {
                        return checkLinkingStatus(linkCode);
                    } catch (Exception e) {
                        logger.warn("Error al verificar estado: " + e.getMessage());
                        return new LinkingStatusResponse();
                    }
                }).thenAccept(status -> {
                    if ("completed".equals(status.status)) {
                        saveKeyFile(status.api_key_encrypted, status.instance_id);

                        String hwid = generateHWID();
                        try {
                            LicenseResponse licenseResponse = verifyApiKey(status.api_key_encrypted, hwid);
                            if (licenseResponse.success) {
                                licenseInfo = licenseResponse.license;
                                licensed = true;
                                instanceId = status.instance_id;
                                encryptedApiKey = status.api_key_encrypted;

                                logger.info("╔═══════════════════════════════════════════════════════════════════════╗");
                                logger.info("║  ¡SERVIDOR VINCULADO CORRECTAMENTE! ✅                               ║");
                                logger.info("╠═══════════════════════════════════════════════════════════════════════╣");
                                logger.info("║  La licencia se ha vinculado correctamente.                         ║");
                                logger.info("║  Plugin: " + String.format("%-59s", licenseResponse.license.plugin_name) + "║");
                                logger.info("║  Usuario: " + String.format("%-59s", licenseResponse.license.discord_username) + "║");
                                logger.info("║  Servidor: " + String.format("%2d/%-62d",
                                    licenseResponse.license.active_servers,
                                    licenseResponse.license.max_servers) + "║");
                                logger.info("╚═══════════════════════════════════════════════════════════════════════╝");

                                enablePluginFeatures();
                            }
                        } catch (Exception e) {
                            logger.error("Error al verificar licencia: " + e.getMessage());
                        }
                    } else if ("expired".equals(status.status)) {
                        logger.error("La sesión de vinculación ha expirado.");
                    } else {
                        server.getScheduler().buildTask(plugin, this)
                            .delay(10, TimeUnit.SECONDS)
                            .schedule();
                    }
                });
            }
        };

        server.getScheduler()
            .buildTask(plugin, (task) -> pollTask.run())
            .delay(10, TimeUnit.SECONDS)
            .schedule();
    }

    private void showLicenseSuccess(LicenseResponse response) {
        logger.info("╔══════════════════════════════════════════╗");
        logger.info("║        LICENCIA VÁLIDA ✅               ║");
        logger.info("╠══════════════════════════════════════════╣");
        logger.info("║ Plugin: " + String.format("%-30s", response.license.plugin_name) + " ║");
        logger.info("║ Usuario: " + String.format("%-29s", response.license.discord_username) + " ║");
        logger.info("║ Rol: " + String.format("%-33s", response.license.role) + " ║");
        logger.info("║ Discord ID: " + String.format("%-26s", response.license.discord_id) + " ║");
        logger.info("║ Servidores: " + String.format("%2d/%-31d",
            response.license.active_servers, response.license.max_servers) + " ║");

        if (response.license.is_lifetime) {
            logger.info("║ Tipo: Lifetime                           ║");
        } else {
            logger.info("║ Expira: " + String.format("%-30s", response.license.expires_at) + " ║");
        }
        logger.info("╚══════════════════════════════════════════╝");
    }

    private void saveKeyFile(String encryptedApiKey, String instanceId) {
        Path keyFile = dataDirectory.resolve("key");
        try {
            String content = "# FurrDownloads License Key\n" +
                "# DO NOT modify this file\n" +
                "key=" + encryptedApiKey + "\n" +
                "instance_id=" + instanceId + "\n";
            Files.writeString(keyFile, content);
        } catch (IOException e) {
            logger.error("Error al guardar archivo key: " + e.getMessage());
        }
    }

    private String readKeyFile(Path keyFile) {
        try {
            String content = Files.readString(keyFile);
            for (String line : content.split("\n")) {
                if (line.startsWith("key=")) {
                    return line.substring(4).trim();
                }
            }
        } catch (IOException e) {
            logger.warn("Error al leer archivo key: " + e.getMessage());
        }
        return null;
    }

    // ============================================
    // LLAMADAS A LA API
    // ============================================

    private LinkingResponse initiateLinking(String hwid, Map<String, String> serverInfo) throws Exception {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"plugin_id\":\"").append(PLUGIN_ID).append("\",");
        json.append("\"hwid\":\"").append(hwid).append("\",");
        json.append("\"server_info\":{");
        json.append("\"name\":\"").append(escapeJson(serverInfo.get("name"))).append("\",");
        json.append("\"version\":\"").append(escapeJson(serverInfo.get("version"))).append("\",");
        json.append("\"platform\":\"velocity\"");
        json.append("}}");

        URL url = new URL(API_URL + "/plugin/link");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("User-Agent", "FurrDownloads-Plugin/2.0");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = json.toString().getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        return parseLinkingResponse(readResponse(conn));
    }

    private LinkingStatusResponse checkLinkingStatus(String code) throws Exception {
        URL url = new URL(API_URL + "/plugin/link/status/" + code);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("User-Agent", "FurrDownloads-Plugin/2.0");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        return parseLinkingStatusResponse(readResponse(conn));
    }

    private LicenseResponse verifyApiKey(String encryptedKey, String hwid) throws Exception {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"api_key\":\"").append(encryptedKey).append("\",");
        json.append("\"hwid\":\"").append(hwid).append("\"");
        json.append("}");

        URL url = new URL(API_URL + "/plugin/verify");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("User-Agent", "FurrDownloads-Plugin/2.0");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = json.toString().getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        return parseLicenseResponse(readResponse(conn));
    }

    private void sendHeartbeat() {
        if (encryptedApiKey == null) return;

        CompletableFuture.supplyAsync(() -> {
            try {
                StringBuilder json = new StringBuilder();
                json.append("{\"api_key\":\"").append(encryptedApiKey).append("\"}");

                URL url = new URL(API_URL + "/plugin/heartbeat");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("User-Agent", "FurrDownloads-Plugin/2.0");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setDoOutput(true);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = json.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                readResponse(conn);
            } catch (Exception e) {
                // Silencioso
            }
            return null;
        });
    }

    private String readResponse(HttpURLConnection conn) throws Exception {
        int responseCode = conn.getResponseCode();
        InputStream is = responseCode < 400 ? conn.getInputStream() : conn.getErrorStream();

        if (is == null) {
            throw new Exception("No response from server (code: " + responseCode + ")");
        }

        BufferedReader br = new BufferedReader(new InputStreamReader(is, "utf-8"));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            response.append(line);
        }

        return response.toString();
    }

    // ============================================
    // PARSERS
    // ============================================

    private LinkingResponse parseLinkingResponse(String json) {
        LinkingResponse response = new LinkingResponse();
        response.success = json.contains("\"success\"") && json.contains("true");

        if (response.success) {
            response.link_code = extractString(json, "link_code");
            response.oauth_url = extractString(json, "oauth_url");
        } else {
            response.error = extractString(json, "error");
        }
        return response;
    }

    private LinkingStatusResponse parseLinkingStatusResponse(String json) {
        LinkingStatusResponse response = new LinkingStatusResponse();
        response.status = extractString(json, "status");
        if ("completed".equals(response.status)) {
            response.api_key_encrypted = extractString(json, "api_key_encrypted");
            response.instance_id = extractString(json, "instance_id");

            response.license = new LicenseInfo();
            response.license.plugin_id = extractString(json, "plugin_id");
            response.license.plugin_name = extractString(json, "plugin_name");
            response.license.discord_id = extractString(json, "discord_id");
            response.license.discord_username = extractString(json, "discord_username");
            response.license.role = extractString(json, "role");
            response.license.max_servers = extractInt(json, "max_servers");
            response.license.active_servers = extractInt(json, "active_servers");
            response.license.is_lifetime = json.contains("\"is_lifetime\"") && json.contains("true");
            response.license.expires_at = extractString(json, "expires_at");
        }
        return response;
    }

    private LicenseResponse parseLicenseResponse(String json) {
        LicenseResponse response = new LicenseResponse();
        response.success = json.contains("\"success\"") && json.contains("true");

        if (response.success) {
            response.license = new LicenseInfo();
            response.license.plugin_id = extractString(json, "plugin_id");
            response.license.plugin_name = extractString(json, "plugin_name");
            response.license.discord_id = extractString(json, "discord_id");
            response.license.discord_username = extractString(json, "discord_username");
            response.license.role = extractString(json, "role");
            response.license.max_servers = extractInt(json, "max_servers");
            response.license.active_servers = extractInt(json, "active_servers");
            response.license.is_lifetime = json.contains("\"is_lifetime\"") && json.contains("true");
            response.license.expires_at = extractString(json, "expires_at");
            response.instance_id = extractString(json, "instance_id");
        } else {
            response.error = extractString(json, "error");
            response.message = extractString(json, "message");
        }

        return response;
    }

    private String extractString(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]+)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : "";
    }

    private int extractInt(String json, String key) {
        String pattern = "\"" + key + "\":(\\d+)";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    // ============================================
    // HWID GENERATION
    // ============================================

    private String generateHWID() {
        try {
            StringBuilder hwidData = new StringBuilder();

            hwidData.append(System.getProperty("os.name"));
            hwidData.append(System.getProperty("os.version"));
            hwidData.append(System.getProperty("os.arch"));
            hwidData.append(System.getProperty("java.version"));
            hwidData.append(server.getBoundAddress().getHostString());
            hwidData.append(String.valueOf(server.getBoundAddress().getPort()));
            hwidData.append("furrdownloads-hwid-salt-velocity");

            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(hwidData.toString().getBytes("UTF-8"));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }

            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            logger.error("SHA-256 algorithm not available - cannot generate HWID");
            throw new RuntimeException("Cannot generate HWID: SHA-256 not available", e);
        } catch (java.io.UnsupportedEncodingException e) {
            logger.error("UTF-8 encoding not available - cannot generate HWID");
            throw new RuntimeException("Cannot generate HWID: UTF-8 not available", e);
        } catch (Exception e) {
            logger.error("Error generating HWID: " + e.getMessage());
            throw new RuntimeException("Cannot generate HWID", e);
        }
    }

    // ============================================
    // GESTIÓN DEL PLUGIN
    // ============================================

    private void enablePluginFeatures() {
        logger.info("Iniciando funcionalidades del plugin...");

        // Iniciar heartbeat cada 5 minutos
        heartbeatTask = server.getScheduler()
            .buildTask(plugin, (task) -> sendHeartbeat())
            .repeat(5, TimeUnit.MINUTES)
            .schedule();

        // Ejecutar callbacks de licencia válida
        for (Runnable callback : licenseValidCallbacks) {
            callback.run();
        }
        licenseValidCallbacks.clear();

        // Verificar actualizaciones después de iniciar
        server.getScheduler().buildTask(plugin, this::checkForUpdates)
            .delay(50, TimeUnit.MILLISECONDS)
            .schedule();

        logger.info("FurrGuard se ha iniciado correctamente con licencia válida.");
    }

    public void shutdown() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
        }
    }

    // ============================================
    // SISTEMA DE ACTUALIZACIONES
    // ============================================

    /**
     * Verifica si hay una nueva versión disponible del plugin
     * Muestra advertencias en consola (colores ANSI para Pterodactyl) y a jugadores OP
     */
    private void checkForUpdates() {
        try {
            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"plugin_id\":\"").append(PLUGIN_ID).append("\",");
            json.append("\"current_version\":\"").append(PLUGIN_VERSION).append("\"");
            json.append("}");

            URL url = new URL(API_URL + "/plugin/check-version");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "FurrDownloads-Plugin/2.0");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = json.toString().getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            String response = readResponse(conn);
            UpdateCheckResult updateResult = parseUpdateCheck(response);

            if (updateResult.has_update) {
                this.availableUpdate = updateResult.update;
                showUpdateWarning(updateResult.update);
                notifyPlayersAboutUpdate(updateResult.update);
            }
        } catch (Exception e) {
            // Silencioso - no mostrar errores al verificar actualizaciones
        }
    }

    /**
     * Muestra advertencia en consola con colores ANSI (compatible con Pterodactyl)
     */
    private void showUpdateWarning(UpdateInfo update) {
        String ANSI_RESET = "\u001B[0m";
        String ANSI_RED = "\u001B[31m";
        String ANSI_BOLD = "\u001B[1m";
        String ANSI_YELLOW = "\u001B[33m";

        logger.warn("");
        logger.warn(ANSI_RED + "╔════════════════════════════════════════════════════════════════╗" + ANSI_RESET);
        logger.warn(ANSI_RED + "║" + ANSI_BOLD + "  ⚠ ¡NUEVA VERSIÓN DISPONIBLE! ⚠" + ANSI_RESET + "                             ║" + ANSI_RESET);
        logger.warn(ANSI_RED + "╠════════════════════════════════════════════════════════════════╣" + ANSI_RESET);
        logger.warn(ANSI_RED + "║  Versión actual: " + ANSI_RESET + PLUGIN_VERSION + ANSI_RED + "    Nueva versión: " + ANSI_YELLOW + update.latest_version + ANSI_RESET + "  ║" + ANSI_RESET);
        logger.warn(ANSI_RED + "║                                                                        ║" + ANSI_RESET);
        logger.warn(ANSI_RED + "║  Descarga la nueva versión en:                                      ║" + ANSI_RESET);
        logger.warn(ANSI_YELLOW + "║  " + update.download_url + " ║" + ANSI_RESET);
        logger.warn(ANSI_RED + "╚════════════════════════════════════════════════════════════════╝" + ANSI_RESET);
        logger.warn("");
    }

    /**
     * Notifica a los jugadores con permiso * (OP) sobre la actualización
     */
    private void notifyPlayersAboutUpdate(UpdateInfo update) {
        String message = "&c&l⚠ ¡NUEVA VERSIÓN DISPONIBLE! &r&e\n" +
                          "&cVersión actual: &e" + PLUGIN_VERSION + " &c→ &aNueva: &e" + update.latest_version + "&c\n" +
                          "&7Descarga: &f" + update.download_url;

        server.getAllPlayers().stream()
            .filter(player -> player.hasPermission("*"))
            .forEach(player -> {
                player.sendMessage(Component.text(""));
                player.sendMessage(Component.text(message.replace("&", "§")));
                player.sendMessage(Component.text(""));
            });
    }

    /**
     * Parsea la respuesta de verificación de actualización
     */
    private UpdateCheckResult parseUpdateCheck(String json) {
        UpdateCheckResult result = new UpdateCheckResult();
        result.has_update = json.contains("\"has_update\":true") || json.contains("\"has_update\": true");

        if (result.has_update) {
            result.update = new UpdateInfo();
            result.update.current_version = extractString(json, "current_version");
            result.update.latest_version = extractString(json, "latest_version");
            result.update.download_url = extractString(json, "download_url");
            result.update.patch_notes = extractString(json, "patch_notes");
        }

        return result;
    }

    // ============================================
    // UTILIDADES
    // ============================================

    private String getLinkUrl(String code) {
        return "https://furrdownloads.srteb.eu/link/" + code + "?redirect=false";
    }

    private String getQrCodeUrl(String code) {
        return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + getLinkUrl(code);
    }

    // ============================================
    // GETTERS PÚBLICOS
    // ============================================

    public boolean isLicensed() {
        return licensed;
    }

    public LicenseInfo getLicenseInfo() {
        return licenseInfo;
    }

    public String getPluginId() {
        return PLUGIN_ID;
    }

    public String getPluginVersion() {
        return PLUGIN_VERSION;
    }

    public UpdateInfo getAvailableUpdate() {
        return availableUpdate;
    }

    /**
     * Registra un callback que se ejecutará cuando la licencia sea válida
     */
    public void onLicenseValid(Runnable callback) {
        if (licensed) {
            callback.run();
        } else {
            licenseValidCallbacks.add(callback);
        }
    }

    // ============================================
    // CLASES INTERNAS
    // ============================================

    public static class LinkingResponse {
        public boolean success;
        public String link_code;
        public String oauth_url;
        public String error;
    }

    public static class LinkingStatusResponse {
        public String status;
        public String api_key_encrypted;
        public String instance_id;
        public LicenseInfo license;
    }

    public static class LicenseResponse {
        public boolean success;
        public String error;
        public String message;
        public LicenseInfo license;
        public String instance_id;
    }

    public static class LicenseInfo {
        public String plugin_id;
        public String plugin_name;
        public String discord_id;
        public String discord_username;
        public String role;
        public int max_servers;
        public int active_servers;
        public boolean is_lifetime;
        public String expires_at;
    }

    public static class UpdateInfo {
        public String current_version;
        public String latest_version;
        public String download_url;
        public String patch_notes;
        public String release_date;
    }

    public static class UpdateCheckResult {
        public boolean has_update;
        public UpdateInfo update;
    }
}
