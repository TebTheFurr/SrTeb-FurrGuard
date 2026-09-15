package org.grinch.furrGuard.license;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.grinch.furrguard.common.json.Json;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** Respuestas del servidor de licencias (FurrDownloads), parseadas con Gson. Nada lanza. */
final class LicenseResponses {

    enum Verdict {
        VALID,
        /** Rechazo explicito (clave invalida o revocada): el unico caso que borra la clave. */
        INVALID,
        /** Red, timeout, 5xx, 429, cuerpo no JSON o {@code can_retry}: se reintenta y aplica la gracia. */
        RETRY
    }

    record LicenseInfo(String pluginName, String discordUsername, String role, int activeServers, int maxServers,
                       boolean lifetime, String expiresAt) {

        static LicenseInfo parse(JsonObject license) {
            return new LicenseInfo(text(license, "plugin_name"), text(license, "discord_username"),
                    text(license, "role"), Json.integer(license, "active_servers", 0),
                    Json.integer(license, "max_servers", 0), Json.bool(license, "is_lifetime", false),
                    text(license, "expires_at"));
        }

        JsonObject toJson() {
            JsonObject json = new JsonObject();
            json.addProperty("plugin_name", pluginName);
            json.addProperty("discord_username", discordUsername);
            json.addProperty("role", role);
            json.addProperty("active_servers", activeServers);
            json.addProperty("max_servers", maxServers);
            json.addProperty("is_lifetime", lifetime);
            json.addProperty("expires_at", expiresAt);
            return json;
        }
    }

    record Verification(Verdict verdict, LicenseInfo license, String error) {
    }

    record LinkStatus(String status, String encryptedKey, String instanceId) {
        boolean completed() {
            return "completed".equals(status) && encryptedKey != null;
        }

        boolean expired() {
            return "expired".equals(status);
        }
    }

    record Update(String latestVersion, String downloadUrl) {
    }

    /** Sin respuesta del servidor de licencias, la red sigue abierta este tiempo desde la ultima verificacion. */
    static final Duration GRACE_PERIOD = Duration.ofHours(72);
    /** Un "ultima verificacion" en el futuro solo se acepta dentro de este margen de reloj. */
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);
    /** Estados con los que un {@code success:false} es definitivo; 5xx, 408, 429... nunca lo son. */
    private static final Set<Integer> DEFINITIVE_STATUSES = Set.of(200, 400, 401, 403, 404, 410, 422);
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{1,128}");
    /** ASCII imprimible sin espacios: la clave va en una linea del archivo key. */
    private static final Pattern SINGLE_LINE = Pattern.compile("[\\x21-\\x7E]{1,4096}");

    private LicenseResponses() {
    }

    static Verification parseVerify(int status, String body) {
        JsonObject json = parseObject(body);
        if (json == null) {
            return new Verification(Verdict.RETRY, null, "HTTP " + status + " sin JSON valido");
        }
        if (status >= 200 && status < 300 && Json.bool(json, "success", false)) {
            JsonObject license = Json.obj(json, "license");
            return new Verification(Verdict.VALID, LicenseInfo.parse(license.size() > 0 ? license : json), null);
        }
        boolean explicitFalse = Json.str(json, "success", null) != null && !Json.bool(json, "success", true);
        boolean rejected = explicitFalse && !Json.bool(json, "can_retry", false) && DEFINITIVE_STATUSES.contains(status);
        String error = "HTTP " + status + " " + firstNonNull(text(json, "error"), text(json, "message"), "sin detalle");
        return new Verification(rejected ? Verdict.INVALID : Verdict.RETRY, null, error);
    }

    static boolean shouldDeleteKey(Verification verification) {
        return verification.verdict() == Verdict.INVALID;
    }

    static Optional<String> parseLinkCode(int status, String body) {
        JsonObject json = parseObject(body);
        if (json == null || status < 200 || status >= 300 || !Json.bool(json, "success", false)) {
            return Optional.empty();
        }
        String code = text(json, "link_code"); // va en una URL y en consola
        return code != null && TOKEN.matcher(code).matches() ? Optional.of(code) : Optional.empty();
    }

    static LinkStatus parseLinkStatus(int status, String body) {
        JsonObject json = parseObject(body);
        if (json == null || status < 200 || status >= 300) {
            return new LinkStatus(null, null, null);
        }
        String key = Json.str(json, "api_key_encrypted", null); // sin limpiar: se rechaza, no se retoca
        String instance = Json.str(json, "instance_id", null);
        return new LinkStatus(text(json, "status"),
                key != null && SINGLE_LINE.matcher(key).matches() ? key : null,
                instance != null && SINGLE_LINE.matcher(instance).matches() ? instance : null);
    }

    static Optional<Update> parseUpdate(int status, String body) {
        JsonObject json = parseObject(body);
        if (json == null || status < 200 || status >= 300 || !Json.bool(json, "has_update", false)) {
            return Optional.empty();
        }
        JsonObject update = Json.obj(json, "update");
        JsonObject source = update.size() > 0 ? update : json;
        return Optional.of(new Update(firstNonNull(text(source, "latest_version"), "?", null),
                firstNonNull(text(source, "download_url"), "?", null)));
    }

    static boolean withinGrace(long lastValidAtMillis, long nowMillis) {
        return lastValidAtMillis > 0
                && lastValidAtMillis <= nowMillis + CLOCK_SKEW.toMillis()
                && nowMillis - lastValidAtMillis < GRACE_PERIOD.toMillis();
    }

    static JsonObject parseObject(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonElement parsed = JsonParser.parseString(body);
            return parsed.isJsonObject() ? parsed.getAsJsonObject() : null;
        } catch (RuntimeException e) { // JsonSyntaxException, anidamiento...
            return null;
        }
    }

    /** Texto sin caracteres de control (acaba en logs); null si falta o esta vacio. */
    static String text(JsonObject json, String key) {
        String value = Json.str(json, key, null);
        if (value == null) {
            return null;
        }
        String clean = value.replaceAll("\\p{Cntrl}", "").strip();
        return clean.isEmpty() ? null : clean.length() > 200 ? clean.substring(0, 200) : clean;
    }

    private static String firstNonNull(String first, String second, String third) {
        return first != null ? first : second != null ? second : third;
    }
}
