package org.grinch.furrsecurity.api;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Interpretacion de las respuestas de docs/API.md §2. Todo lo que no sea una respuesta valida y
 * explicita se trata como "seguir bloqueado".
 */
public final class Replies {

    public static final long RETRY_MILLIS = 5_000;
    public static final long SLOW_RETRY_MILLIS = 60_000;

    private Replies() {
    }

    /** Espera antes de reintentar: respeta {@code Retry-After} y no insiste cada 5 s con una clave invalida. */
    public static long retryDelayMillis(ApiResult result) {
        if (result instanceof Failure failure) {
            return switch (failure.kind()) {
                case RATE_LIMITED -> Math.max(RETRY_MILLIS, failure.retryAfterMillis());
                case UNAUTHORIZED, NOT_CONFIGURED, CLIENT_ERROR -> SLOW_RETRY_MILLIS;
                default -> RETRY_MILLIS;
            };
        }
        return RETRY_MILLIS;
    }

    /** Para logs: nunca incluye el cuerpo. */
    public static String describe(ApiResult result) {
        if (result instanceof Failure failure) {
            return failure.kind() + (failure.message().isEmpty() ? "" : " - " + failure.message());
        }
        return "respuesta sin los campos esperados";
    }

    /** {@code check_status}. Solo {@code needs_verification:false} explicito desbloquea. */
    public record CheckStatus(Decision decision, String reason, long sessionSeconds) {

        public enum Decision { UNLOCK, VERIFY, RETRY }

        public static CheckStatus from(ApiResult result) {
            if (result instanceof Success ok && ok.body().has("needs_verification")) {
                JsonObject body = ok.body();
                boolean needsVerification = Json.bool(body, "needs_verification", true);
                return new CheckStatus(needsVerification ? Decision.VERIFY : Decision.UNLOCK,
                        Json.str(body, "reason", ""),
                        Json.longValue(Json.obj(body, "session"), "time_remaining_seconds", -1));
            }
            return new CheckStatus(Decision.RETRY, "", -1);
        }
    }

    /** {@code generate_token}; {@code null} si no hay enlace utilizable (fallo o {@code not_in_whitelist}). */
    public record TokenGrant(String token, String verifyUrl, boolean existing) {

        public static TokenGrant from(ApiResult result) {
            if (result instanceof Success ok && Json.bool(ok.body(), "success", false)) {
                String token = Json.str(ok.body(), "token", "");
                String url = Json.str(ok.body(), "verify_url", "");
                if (!token.isBlank() && !url.isBlank()) {
                    return new TokenGrant(token, url, Json.bool(ok.body(), "existing", false));
                }
            }
            return null;
        }
    }

    /** {@code verify_token_status}. Un fallo o un estado desconocido cuentan como pendiente. */
    public record TokenStatus(State state, long sessionSeconds) {

        public enum State { PENDING, VERIFIED, EXPIRED, NOT_FOUND }

        public static TokenStatus from(ApiResult result) {
            if (result instanceof Success ok) {
                JsonObject body = ok.body();
                switch (Json.str(body, "status", "")) {
                    case "verified" -> {
                        if (Json.bool(body, "verified", false)) {
                            return new TokenStatus(State.VERIFIED, Json.longValue(body, "time_remaining_seconds", -1));
                        }
                    }
                    case "token_expired", "expired" -> {
                        return new TokenStatus(State.EXPIRED, -1);
                    }
                    case "not_found" -> {
                        return new TokenStatus(State.NOT_FOUND, -1);
                    }
                    default -> {
                        // pending o desconocido
                    }
                }
            }
            return new TokenStatus(State.PENDING, -1);
        }
    }

    /** {@code get_session}: segundos restantes, 0 si no hay sesion valida, -1 si la API fallo. */
    public static long sessionSeconds(ApiResult result) {
        if (!(result instanceof Success ok)) {
            return -1;
        }
        if (!Json.bool(ok.body(), "has_session", false)) {
            return 0;
        }
        return Math.max(0, Json.longValue(Json.obj(ok.body(), "session"), "time_remaining_seconds", 0));
    }

    /** {@code get_staff}: nicks normalizados, o {@code null} si la respuesta no sirve. */
    public static Set<String> staffNicks(ApiResult result) {
        if (!(result instanceof Success ok) || !ok.body().has("staff") || !ok.body().get("staff").isJsonArray()) {
            return null;
        }
        Set<String> nicks = new HashSet<>();
        for (JsonElement entry : Json.arr(ok.body(), "staff")) {
            if (entry.isJsonObject()) {
                String nick = normalizeNick(Json.str(entry.getAsJsonObject(), "nick", ""));
                if (!nick.isEmpty()) {
                    nicks.add(nick);
                }
            }
        }
        return Set.copyOf(nicks);
    }

    /**
     * Minusculas y sin el prefijo de Floodgate ({@code .}/{@code *}): quien entra como {@code .Nombre}
     * se trata como candidato si {@code Nombre} es staff (el servidor decide despues).
     */
    public static String normalizeNick(String nick) {
        if (nick == null) {
            return "";
        }
        String trimmed = nick.strip();
        if (trimmed.startsWith(".") || trimmed.startsWith("*")) {
            trimmed = trimmed.substring(1);
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
