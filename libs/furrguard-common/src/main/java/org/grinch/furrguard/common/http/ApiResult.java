package org.grinch.furrguard.common.http;

import com.google.gson.JsonObject;

import java.util.Objects;

/**
 * Resultado de una llamada a la API. Nunca hay excepciones: o {@link Success} o {@link Failure}.
 *
 * <pre>{@code
 * if (result instanceof ApiResult.Success ok) {
 *     boolean allowed = Json.bool(ok.body(), "allowed", false);
 * } else if (result instanceof ApiResult.Failure failure) {
 *     // fallar en cerrado donde lo exige docs/API.md
 * }
 * }</pre>
 */
public sealed interface ApiResult permits ApiResult.Success, ApiResult.Failure {

    enum Kind {
        /** Conexion rechazada, DNS o E/S, tras agotar reintentos. */
        NETWORK,
        /** Se agoto el plazo total de la peticion. */
        TIMEOUT,
        /** HTTP 429, bloqueo activo por {@code Retry-After} o limitador local saturado. */
        RATE_LIMITED,
        /** HTTP 401/403: clave invalida. No se reintenta. */
        UNAUTHORIZED,
        /** HTTP 5xx tras agotar reintentos. */
        SERVER_ERROR,
        /** Resto de 4xx. No se reintenta. */
        CLIENT_ERROR,
        /** Redireccion, cuerpo demasiado grande, JSON invalido o que no es un objeto. */
        INVALID_RESPONSE,
        /**
         * Configuracion invalida (URL, clave de ejemplo...) o cliente cerrado, sin tocar la red; o HTTP 503
         * {@code api_key_not_configured} (el panel aun no tiene clave). No se reintenta.
         */
        NOT_CONFIGURED
    }

    /** Respuesta 2xx cuyo cuerpo es un objeto JSON. */
    record Success(int status, JsonObject body) implements ApiResult {
        public Success {
            body = body == null ? new JsonObject() : body;
        }

        @Override
        public String toString() {
            return "Success[status=" + status + "]"; // sin cuerpo: puede acabar en un log
        }
    }

    /**
     * @param status           codigo HTTP, o 0 si no hubo respuesta
     * @param message          descripcion breve en espanol; nunca incluye la clave ni el cuerpo
     * @param retryAfterMillis espera sugerida antes de reintentar (solo {@link Kind#RATE_LIMITED}), si no 0
     */
    record Failure(Kind kind, int status, String message, long retryAfterMillis) implements ApiResult {
        public Failure {
            Objects.requireNonNull(kind, "kind");
            message = message == null ? "" : message;
            retryAfterMillis = Math.max(0, retryAfterMillis);
        }
    }
}
