package org.grinch.furrguard.common.http;

import java.time.Duration;

/**
 * Configuracion inmutable de {@link ApiClient}. Crear con {@link #builder(String, String)}.
 * No valida al construir (nunca lanza): {@link ApiClient#validateConfig(ApiClientConfig)} lista los
 * problemas y el cliente responde {@code NOT_CONFIGURED} mientras los haya.
 *
 * @param baseUrl           endpoint completo, p. ej. {@code https://furrguard.srteb.eu/api/plugin.php}
 * @param connectTimeout    plazo para establecer la conexion TCP/TLS
 * @param requestTimeout    plazo <b>total</b> de cada llamada: esperas del limitador, reintentos y
 *                          lectura del cuerpo incluidos. Pasado ese plazo el futuro ya esta resuelto.
 * @param maxRetries        reintentos tras un 5xx, error de E/S o timeout de conexion (0 = ninguno)
 * @param maxResponseBytes  tamano maximo del cuerpo; se corta la lectura al superarlo
 * @param requestsPerSecond ritmo del limitador local (token bucket, rafaga del mismo tamano)
 * @param allowInsecureHttp permite {@code http://} (solo desarrollo: la clave viajaria en claro)
 */
public record ApiClientConfig(
        String baseUrl,
        String apiKey,
        String userAgent,
        Duration connectTimeout,
        Duration requestTimeout,
        int maxRetries,
        int maxResponseBytes,
        double requestsPerSecond,
        boolean allowInsecureHttp) {

    public static final String DEFAULT_USER_AGENT = "FurrGuard-Common/2.0.0";
    public static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(10);
    public static final int DEFAULT_MAX_RETRIES = 2;
    public static final int DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;
    public static final double DEFAULT_REQUESTS_PER_SECOND = 20;

    public ApiClientConfig {
        baseUrl = baseUrl == null ? "" : baseUrl.strip();
        apiKey = apiKey == null ? "" : apiKey.strip();
        userAgent = userAgent == null || userAgent.isBlank() ? DEFAULT_USER_AGENT : userAgent.strip();
    }

    public static Builder builder(String baseUrl, String apiKey) {
        return new Builder(baseUrl, apiKey);
    }

    /** Sin la clave: la configuracion puede acabar en un log. */
    @Override
    public String toString() {
        return "ApiClientConfig[baseUrl=" + baseUrl
                + ", apiKey=" + (apiKey.isEmpty() ? "<vacia>" : "<oculta>")
                + ", userAgent=" + userAgent
                + ", connectTimeout=" + connectTimeout
                + ", requestTimeout=" + requestTimeout
                + ", maxRetries=" + maxRetries
                + ", maxResponseBytes=" + maxResponseBytes
                + ", requestsPerSecond=" + requestsPerSecond
                + ", allowInsecureHttp=" + allowInsecureHttp + "]";
    }

    public static final class Builder {
        private final String baseUrl;
        private final String apiKey;
        private String userAgent = DEFAULT_USER_AGENT;
        private Duration connectTimeout = DEFAULT_CONNECT_TIMEOUT;
        private Duration requestTimeout = DEFAULT_REQUEST_TIMEOUT;
        private int maxRetries = DEFAULT_MAX_RETRIES;
        private int maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES;
        private double requestsPerSecond = DEFAULT_REQUESTS_PER_SECOND;
        private boolean allowInsecureHttp;

        private Builder(String baseUrl, String apiKey) {
            this.baseUrl = baseUrl;
            this.apiKey = apiKey;
        }

        public Builder userAgent(String userAgent) {
            this.userAgent = userAgent;
            return this;
        }

        public Builder connectTimeout(Duration connectTimeout) {
            this.connectTimeout = connectTimeout;
            return this;
        }

        public Builder requestTimeout(Duration requestTimeout) {
            this.requestTimeout = requestTimeout;
            return this;
        }

        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        public Builder maxResponseBytes(int maxResponseBytes) {
            this.maxResponseBytes = maxResponseBytes;
            return this;
        }

        public Builder requestsPerSecond(double requestsPerSecond) {
            this.requestsPerSecond = requestsPerSecond;
            return this;
        }

        public Builder allowInsecureHttp(boolean allowInsecureHttp) {
            this.allowInsecureHttp = allowInsecureHttp;
            return this;
        }

        public ApiClientConfig build() {
            return new ApiClientConfig(baseUrl, apiKey, userAgent, connectTimeout, requestTimeout,
                    maxRetries, maxResponseBytes, requestsPerSecond, allowInsecureHttp);
        }
    }
}
