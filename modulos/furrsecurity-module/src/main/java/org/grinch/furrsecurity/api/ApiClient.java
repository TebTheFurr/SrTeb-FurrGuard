package org.grinch.furrsecurity.api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.grinch.furrsecurity.FurrSecurity;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * HTTP client for communicating with the FurrSecurity web API
 */
public class ApiClient {

    private final FurrSecurity plugin;
    private final Gson gson;
    private final String apiUrl;
    private final String apiKey;
    private final int timeout;
    private static final int MAX_RETRIES = 2;
    private static final int RETRY_DELAY_MS = 1000;

    public ApiClient(FurrSecurity plugin) {
        this.plugin = plugin;
        this.gson = new Gson();
        this.apiUrl = plugin.getConfig().getApiUrl();
        this.apiKey = plugin.getConfig().getApiKey();
        this.timeout = 10000; // 10 seconds
    }

    /**
     * Check if a player needs verification
     */
    public CompletableFuture<VerificationStatus> checkStatus(String uuid, String nick, String ip) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        params.put("nick", nick);
        params.put("ip", ip);

        return post("check_status", params).thenApply(response -> {
            VerificationStatus status = new VerificationStatus();
            if (response.has("needs_verification")) {
                status.needsVerification = response.get("needs_verification").getAsBoolean();
                status.reason = response.has("reason") ? response.get("reason").getAsString() : null;
                if (response.has("discord_id")) {
                    status.discordId = response.get("discord_id").getAsString();
                }
                if (response.has("session")) {
                    JsonObject session = response.getAsJsonObject("session");
                    if (session.has("time_remaining_seconds")) {
                        status.timeRemaining = session.get("time_remaining_seconds").getAsLong();
                    }
                }
            }
            return status;
        });
    }

    /**
     * Generate a verification token for a player
     */
    public CompletableFuture<TokenResult> generateToken(String uuid, String nick, String ip) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        params.put("nick", nick);
        params.put("ip", ip);

        return post("generate_token", params).thenApply(response -> {
            TokenResult result = new TokenResult();
            if (response.has("success") && response.get("success").getAsBoolean()) {
                result.success = true;
                result.token = response.get("token").getAsString();
                result.verifyUrl = response.get("verify_url").getAsString();
                result.existing = response.has("existing") && response.get("existing").getAsBoolean();
                if (response.has("token_expires_in_seconds")) {
                    result.tokenExpiresInSeconds = response.get("token_expires_in_seconds").getAsLong();
                }
            } else {
                result.success = false;
                result.error = response.has("error") ? response.get("error").getAsString() : "Unknown error";
            }
            return result;
        });
    }

    /**
     * Check if a token has been verified (for polling)
     */
    public CompletableFuture<TokenStatus> verifyTokenStatus(String token) {
        Map<String, String> params = new HashMap<>();
        params.put("token", token);

        return post("verify_token_status", params).thenApply(response -> {
            TokenStatus status = new TokenStatus();
            status.status = response.has("status") ? response.get("status").getAsString() : "unknown";
            status.verified = response.has("verified") && response.get("verified").getAsBoolean();
            status.tokenExpired = "token_expired".equals(status.status) || "expired".equals(status.status);
            if (response.has("expires_at")) {
                status.expiresAt = response.get("expires_at").getAsString();
            }
            if (response.has("token_expires_in_seconds")) {
                status.tokenExpiresInSeconds = response.get("token_expires_in_seconds").getAsLong();
            }
            return status;
        });
    }

    /**
     * Get session info for a player
     */
    public CompletableFuture<SessionInfo> getSession(String uuid) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);

        return post("get_session", params).thenApply(response -> {
            SessionInfo info = new SessionInfo();
            if (response.has("has_session") && response.get("has_session").getAsBoolean()) {
                info.hasSession = true;
                JsonObject session = response.getAsJsonObject("session");
                info.nick = session.has("nick") ? session.get("nick").getAsString() : null;
                info.discordId = session.has("discord_id") ? session.get("discord_id").getAsString() : null;
                info.expiresAt = session.has("expires_at") ? session.get("expires_at").getAsString() : null;
                info.timeRemaining = session.has("time_remaining_seconds")
                        ? session.get("time_remaining_seconds").getAsLong() : 0;
            } else {
                info.hasSession = false;
            }
            return info;
        });
    }

    /**
     * Extend a session
     */
    public CompletableFuture<Boolean> extendSession(String uuid, String token) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        if (token != null) {
            params.put("token", token);
        }

        return post("extend_session", params).thenApply(response ->
                response.has("success") && response.get("success").getAsBoolean());
    }

    /**
     * Notify API of player disconnect
     */
    public CompletableFuture<Void> playerDisconnect(String uuid, String nick) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        params.put("nick", nick);

        return post("player_disconnect", params).thenApply(response -> null);
    }

    /**
     * Record a failed verification attempt (token expired without verification)
     * Returns the number of failed attempts and whether player was blacklisted
     */
    public CompletableFuture<FailedAttemptResult> recordFailedAttempt(String uuid, String nick, String ip) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        params.put("nick", nick);
        params.put("ip", ip);

        return post("record_failed_attempt", params).thenApply(response -> {
            FailedAttemptResult result = new FailedAttemptResult();
            result.success = response.has("success") && response.get("success").getAsBoolean();
            if (response.has("failed_attempts")) {
                result.failedAttempts = response.get("failed_attempts").getAsInt();
            }
            result.blacklisted = response.has("blacklisted") && response.get("blacklisted").getAsBoolean();
            if (response.has("error")) {
                result.error = response.get("error").getAsString();
            }
            return result;
        });
    }

    /**
     * Reset a player's session (force re-verification)
     */
    public CompletableFuture<ResetResult> resetSession(String uuid, String nick) {
        Map<String, String> params = new HashMap<>();
        params.put("uuid", uuid);
        params.put("nick", nick);

        return post("reset_session", params).thenApply(response -> {
            ResetResult result = new ResetResult();
            result.success = response.has("success") && response.get("success").getAsBoolean();
            if (response.has("sessions_expired")) {
                result.sessionsExpired = response.get("sessions_expired").getAsInt();
            }
            if (response.has("message")) {
                result.message = response.get("message").getAsString();
            }
            if (response.has("error")) {
                result.error = response.get("error").getAsString();
            }
            return result;
        });
    }

    /**
     * Make a POST request to the API with retry logic
     */
    private CompletableFuture<JsonObject> post(String action, Map<String, String> params) {
        return CompletableFuture.supplyAsync(() -> {
            Exception lastException = null;

            for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS);
                        plugin.getLogger().info("Retrying API request for action " + action + " (attempt " + (attempt + 1) + ")");
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }

                try {
                    String urlStr = apiUrl + "?action=" + action;
                    URL url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();

                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    conn.setRequestProperty("X-API-Key", apiKey);
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(timeout);
                    conn.setReadTimeout(timeout);

                    // Build POST body
                    StringBuilder body = new StringBuilder();
                    for (Map.Entry<String, String> entry : params.entrySet()) {
                        if (body.length() > 0) body.append("&");
                        body.append(entry.getKey()).append("=").append(urlEncode(entry.getValue()));
                    }

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    int responseCode = conn.getResponseCode();

                    // Read error response body for better debugging
                    if (responseCode != 200) {
                        String errorBody = readErrorResponse(conn);
                        plugin.getLogger().warning("API returned status " + responseCode + " for action " + action +
                                (errorBody.isEmpty() ? "" : ": " + errorBody));

                        // Don't retry on 4xx errors (client errors)
                        if (responseCode >= 400 && responseCode < 500) {
                            return new JsonObject();
                        }
                        // Retry on 5xx or other errors
                        continue;
                    }

                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }

                        String responseStr = response.toString();
                        if (responseStr.isEmpty()) {
                            plugin.getLogger().warning("Empty response from API for action " + action);
                            return new JsonObject();
                        }

                        return JsonParser.parseString(responseStr).getAsJsonObject();
                    }
                } catch (IOException e) {
                    lastException = e;
                    plugin.getLogger().log(Level.WARNING, "API request failed for action " + action + " (attempt " + (attempt + 1) + "): " + e.getMessage());
                } catch (Exception e) {
                    lastException = e;
                    plugin.getLogger().log(Level.SEVERE, "Unexpected error in API request for action " + action + ": " + e.getMessage());
                    break;
                }
            }

            // All retries failed
            if (lastException != null) {
                plugin.getLogger().log(Level.WARNING, "All API request attempts failed for action " + action);
            }
            return new JsonObject();
        });
    }

    /**
     * Read error response body from failed request
     */
    private String readErrorResponse(HttpURLConnection conn) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            return response.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value, "UTF-8");
        } catch (Exception e) {
            return value;
        }
    }

    // Response classes

    public static class VerificationStatus {
        public boolean needsVerification;
        public String reason;
        public String discordId;
        public long timeRemaining;
    }

    public static class TokenResult {
        public boolean success;
        public String token;
        public String verifyUrl;
        public String error;
        public boolean existing; // True if returning existing token
        public long tokenExpiresInSeconds; // Time until token link expires
    }

    public static class TokenStatus {
        public String status;
        public boolean verified;
        public boolean tokenExpired; // True if token link expired without verification
        public String expiresAt;
        public long tokenExpiresInSeconds; // Time until token link expires
    }

    public static class SessionInfo {
        public boolean hasSession;
        public String nick;
        public String discordId;
        public String expiresAt;
        public long timeRemaining;
    }

    public static class ResetResult {
        public boolean success;
        public int sessionsExpired;
        public String message;
        public String error;
    }

    public static class FailedAttemptResult {
        public boolean success;
        public int failedAttempts;
        public boolean blacklisted;
        public String error;
    }

    /**
     * Fetch messages from the web API for the FurrSecurity module
     */
    public Map<String, String> getMessages() {
        Map<String, String> messages = new HashMap<>();
        try {
            String urlStr = apiUrl + "?action=get_messages";
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("X-API-Key", apiKey);
            conn.setConnectTimeout(timeout);
            conn.setReadTimeout(timeout);

            int code = conn.getResponseCode();
            if (code != 200) return messages;

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);

                if (sb.length() == 0) return messages;
                JsonObject json = JsonParser.parseString(sb.toString()).getAsJsonObject();
                if (json.has("messages") && json.get("messages").isJsonObject()) {
                    JsonObject msgs = json.getAsJsonObject("messages");
                    for (Map.Entry<String, com.google.gson.JsonElement> entry : msgs.entrySet()) {
                        if (entry.getKey().startsWith("furr_security_")) {
                            messages.put(entry.getKey(), entry.getValue().getAsString());
                        }
                    }
                }
            }
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to load messages from API: " + e.getMessage());
        }
        return messages;
    }
}
