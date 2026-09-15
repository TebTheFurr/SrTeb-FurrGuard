package org.grinch.furrguard.common.http;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiClientTest {

    private static final String KEY = "fg_0123456789abcdef0123456789abcdef0123456789abcdef";

    @FunctionalInterface
    private interface Handler {
        void handle(HttpExchange exchange, int hit) throws Exception;
    }

    private HttpServer server;
    private final AtomicInteger hits = new AtomicInteger();
    private final Map<String, String> seen = new ConcurrentHashMap<>();
    private volatile Handler handler = (exchange, hit) -> respond(exchange, 200, "{}");
    private ApiClient client;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.setExecutor(Executors.newCachedThreadPool(runnable -> {
            Thread thread = new Thread(runnable, "test-http-server");
            thread.setDaemon(true);
            return thread;
        }));
        server.createContext("/api", exchange -> {
            try {
                handler.handle(exchange, hits.incrementAndGet());
            } catch (Exception e) {
                exchange.close();
            }
        });
        server.createContext("/stolen", exchange -> {
            seen.put("stolen", String.valueOf(exchange.getRequestHeaders().getFirst("X-API-Key")));
            respond(exchange, 200, "{\"allowed\":true}");
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        if (client != null) {
            client.close();
        }
        server.stop(0);
    }

    private String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/api/plugin.php";
    }

    private ApiClientConfig.Builder config() {
        return ApiClientConfig.builder(url(), KEY).allowInsecureHttp(true);
    }

    private ApiClient client(ApiClientConfig config) {
        client = new ApiClient(config);
        return client;
    }

    private static ApiResult await(CompletableFuture<ApiResult> future) throws Exception {
        return future.get(20, TimeUnit.SECONDS);
    }

    private static Failure failure(ApiResult result, Kind kind) {
        Failure failure = assertInstanceOf(Failure.class, result);
        assertEquals(kind, failure.kind(), failure.toString());
        return failure;
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    @Test
    void successPostsFormWithKeyAndUserAgent() throws Exception {
        handler = (exchange, hit) -> {
            seen.put("method", exchange.getRequestMethod());
            seen.put("query", exchange.getRequestURI().getRawQuery());
            seen.put("key", exchange.getRequestHeaders().getFirst("X-API-Key"));
            seen.put("ua", exchange.getRequestHeaders().getFirst("User-Agent"));
            seen.put("type", exchange.getRequestHeaders().getFirst("Content-Type"));
            seen.put("body", new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"allowed\":true,\"reason\":null}");
        };
        Map<String, String> form = new LinkedHashMap<>();
        form.put("nick", "Bob & Co");
        form.put("ip", "1.2.3.4");
        form.put("uuid", null);

        ApiResult result = await(client(config().userAgent("FurrGuard-Test/2.0").build()).post("check_player", form));

        Success success = assertInstanceOf(Success.class, result);
        assertEquals(200, success.status());
        assertTrue(Json.bool(success.body(), "allowed", false));
        assertEquals("POST", seen.get("method"));
        assertEquals("action=check_player", seen.get("query"));
        assertEquals(KEY, seen.get("key"));
        assertEquals("FurrGuard-Test/2.0", seen.get("ua"));
        assertEquals("application/x-www-form-urlencoded", seen.get("type"));
        assertEquals("nick=Bob+%26+Co&ip=1.2.3.4&uuid=", seen.get("body"));
        assertFalse(success.toString().contains("allowed"), "toString sin cuerpo");
    }

    @Test
    void rateLimitWithRetryAfterBlocksFollowingCallsWithoutNetwork() throws Exception {
        handler = (exchange, hit) -> {
            exchange.getResponseHeaders().add("Retry-After", "30");
            respond(exchange, 429, "{\"error\":\"rate_limited\",\"retry_after\":30}");
        };
        ApiClient api = client(config().build());

        Failure first = failure(await(api.post("check_status", Map.of())), Kind.RATE_LIMITED);
        assertEquals(429, first.status());
        assertEquals(30_000, first.retryAfterMillis());

        CompletableFuture<ApiResult> second = api.post("get_settings", Map.of());
        assertTrue(second.isDone(), "falla al momento, sin esperar a la red");
        Failure blocked = failure(await(second), Kind.RATE_LIMITED);
        assertEquals(0, blocked.status());
        assertTrue(blocked.retryAfterMillis() > 25_000 && blocked.retryAfterMillis() <= 30_000, blocked.toString());
        assertEquals(1, hits.get(), "la segunda llamada no toca la red");
    }

    @Test
    void rateLimitBlockExpires() throws Exception {
        handler = (exchange, hit) -> {
            if (hit == 1) {
                exchange.getResponseHeaders().add("Retry-After", "1");
                respond(exchange, 429, "{}");
            } else {
                respond(exchange, 200, "{\"ok\":true}");
            }
        };
        ApiClient api = client(config().build());

        failure(await(api.post("a", Map.of())), Kind.RATE_LIMITED);
        failure(await(api.post("a", Map.of())), Kind.RATE_LIMITED);
        Thread.sleep(1_200);

        assertInstanceOf(Success.class, await(api.post("a", Map.of())));
        assertEquals(2, hits.get());
    }

    @Test
    void rateLimitWithoutHeaderUsesBodyThenDefaultAndIsCapped() throws Exception {
        handler = (exchange, hit) -> {
            switch (hit) {
                case 1 -> respond(exchange, 429, "{\"retry_after\":2}");
                case 2 -> respond(exchange, 429, "not json");
                default -> {
                    exchange.getResponseHeaders().add("Retry-After", "99999");
                    respond(exchange, 429, "{}");
                }
            }
        };

        assertEquals(2_000, failure(await(client(config().build()).post("a", Map.of())), Kind.RATE_LIMITED)
                .retryAfterMillis());
        client.close();
        assertEquals(5_000, failure(await(client(config().build()).post("a", Map.of())), Kind.RATE_LIMITED)
                .retryAfterMillis());
        client.close();
        assertEquals(ApiClient.MAX_RETRY_AFTER_MILLIS,
                failure(await(client(config().build()).post("a", Map.of())), Kind.RATE_LIMITED).retryAfterMillis());
    }

    @Test
    void parsesRetryAfterSecondsAndHttpDate() {
        long now = System.currentTimeMillis();
        String inNinetySeconds = DateTimeFormatter.RFC_1123_DATE_TIME
                .format(ZonedDateTime.ofInstant(Instant.ofEpochMilli(now), ZoneOffset.UTC).plusSeconds(90));

        assertEquals(120_000, ApiClient.parseRetryAfter("120", now));
        assertEquals(5_000, ApiClient.parseRetryAfter("  5 ", now));
        long dateMillis = ApiClient.parseRetryAfter(inNinetySeconds, now);
        assertTrue(dateMillis > 88_000 && dateMillis <= 90_000, String.valueOf(dateMillis));
        assertEquals(0, ApiClient.parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", now), "fecha pasada");
        assertEquals(-1, ApiClient.parseRetryAfter("pronto", now));
        assertEquals(-1, ApiClient.parseRetryAfter("-5", now));
        assertEquals(-1, ApiClient.parseRetryAfter(null, now));
        assertTrue(ApiClient.parseRetryAfter("99999999999999999999999", now) > 0, "sin desbordar");
    }

    @Test
    void doesNotFollowRedirectsNorLeakKey() throws Exception {
        handler = (exchange, hit) -> {
            exchange.getResponseHeaders().add("Location", "/stolen");
            respond(exchange, 302, "");
        };

        Failure result = failure(await(client(config().build()).post("check_player", Map.of())), Kind.INVALID_RESPONSE);

        assertEquals(302, result.status());
        assertFalse(seen.containsKey("stolen"), "no se siguio la redireccion");
        assertEquals(1, hits.get());
    }

    @Test
    void oversizedResponseIsInvalidAndNotRetried() throws Exception {
        handler = (exchange, hit) -> {
            exchange.sendResponseHeaders(200, 0); // chunked: sin Content-Length, obliga a cortar leyendo
            try (OutputStream out = exchange.getResponseBody()) {
                out.write("{\"padding\":\"".getBytes(StandardCharsets.UTF_8));
                out.write("x".repeat(64 * 1024).getBytes(StandardCharsets.UTF_8));
                out.write("\"}".getBytes(StandardCharsets.UTF_8));
            }
        };

        Failure result = failure(await(client(config().maxResponseBytes(1024).build()).post("a", Map.of())),
                Kind.INVALID_RESPONSE);

        assertTrue(result.message().contains("1024"), result.message());
        assertEquals(1, hits.get());
    }

    @Test
    void serverErrorsAreRetriedWithBackoffThenFail() throws Exception {
        handler = (exchange, hit) -> respond(exchange, 500, "{\"error\":\"internal_error\"}");
        long start = System.nanoTime();

        Failure result = failure(await(client(config().build()).post("check_player", Map.of())), Kind.SERVER_ERROR);

        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        assertEquals(500, result.status());
        assertTrue(result.message().contains("internal_error"), result.message());
        assertEquals(3, hits.get(), "1 intento + 2 reintentos");
        assertTrue(elapsedMillis >= 900, "backoff ~250 ms + ~1 s, fue " + elapsedMillis);
    }

    @Test
    void serverErrorThenSuccess() throws Exception {
        handler = (exchange, hit) -> respond(exchange, hit == 1 ? 503 : 200, hit == 1 ? "" : "{\"ok\":1}");

        assertInstanceOf(Success.class, await(client(config().build()).post("a", Map.of())));
        assertEquals(2, hits.get());
    }

    @Test
    void postOnceDoesNotRetryServerErrors() throws Exception {
        handler = (exchange, hit) -> respond(exchange, 500, "");

        failure(await(client(config().build()).postOnce("record_failed_attempt", Map.of())), Kind.SERVER_ERROR);

        assertEquals(1, hits.get());
    }

    @Test
    void apiKeyNotConfiguredIsConfigurationNotAnOutage() throws Exception {
        handler = (exchange, hit) -> respond(exchange, 503,
                "{\"error\":\"api_key_not_configured\",\"message\":\"Sin clave\"}");

        Failure failure = failure(await(client(config().build()).post("check_player", Map.of())), Kind.NOT_CONFIGURED);

        assertEquals(503, failure.status());
        assertTrue(failure.message().startsWith("HTTP 503 (api_key_not_configured)"), failure.message());
        assertEquals(1, hits.get(), "sin reintentos: no es una caida");
    }

    @Test
    void otherServiceUnavailableStaysAServerError() throws Exception {
        handler = (exchange, hit) -> respond(exchange, 503, "{\"error\":\"database_unavailable\",\"retry_after\":5}");

        failure(await(client(config().maxRetries(0).build()).post("check_player", Map.of())), Kind.SERVER_ERROR);
    }

    @Test
    void unauthorizedAndClientErrorsAreNotRetried() throws Exception {
        handler = (exchange, hit) -> respond(exchange, hit == 1 ? 401 : hit == 2 ? 403 : 422,
                "{\"error\":\"invalid_api_key\",\"message\":\"Clave <script> invalida\"}");
        ApiClient api = client(config().build());

        Failure unauthorized = failure(await(api.post("a", Map.of())), Kind.UNAUTHORIZED);
        assertEquals(401, unauthorized.status());
        assertEquals("HTTP 401 (invalid_api_key)", unauthorized.message(), "solo el slug, nunca el cuerpo");
        failure(await(api.post("a", Map.of())), Kind.UNAUTHORIZED);
        failure(await(api.post("a", Map.of())), Kind.CLIENT_ERROR);
        assertEquals(3, hits.get(), "una peticion por llamada");
    }

    @Test
    void nonObjectBodiesAreInvalidResponses() throws Exception {
        String[] bodies = {"[1,2,3]", "\"allowed\"", "", "{\"allowed\": tru", "[".repeat(100_000)};
        handler = (exchange, hit) -> respond(exchange, 200, bodies[hit - 1]);
        ApiClient api = client(config().build());

        for (String body : bodies) {
            failure(await(api.post("a", Map.of())), Kind.INVALID_RESPONSE);
        }
        assertEquals(bodies.length, hits.get(), "sin reintentos");
    }

    @Test
    void slowServerTimesOutWithinTotalDeadline() throws Exception {
        handler = (exchange, hit) -> {
            Thread.sleep(3_000);
            respond(exchange, 200, "{}");
        };
        long start = System.nanoTime();

        failure(await(client(config().requestTimeout(Duration.ofMillis(400)).build()).post("a", Map.of())),
                Kind.TIMEOUT);

        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        assertTrue(elapsedMillis < 1_500, "plazo total 400 ms, fue " + elapsedMillis);
        assertEquals(1, hits.get(), "sin plazo restante no hay reintento");
    }

    @Test
    void stalledBodyTimesOutWithinTotalDeadline() throws Exception {
        handler = (exchange, hit) -> {
            exchange.sendResponseHeaders(200, 0);
            OutputStream out = exchange.getResponseBody();
            out.write("{\"allowed\":".getBytes(StandardCharsets.UTF_8));
            out.flush();
            Thread.sleep(3_000); // cabeceras enviadas, cuerpo a medias
            out.write("true}".getBytes(StandardCharsets.UTF_8));
            out.close();
        };
        long start = System.nanoTime();

        failure(await(client(config().requestTimeout(Duration.ofMillis(500)).build()).post("a", Map.of())),
                Kind.TIMEOUT);

        assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 1_500);
    }

    @Test
    void connectionRefusedIsNetworkError() throws Exception {
        int freePort;
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            freePort = socket.getLocalPort();
        }
        ApiClientConfig config = ApiClientConfig.builder("http://127.0.0.1:" + freePort + "/api/plugin.php", KEY)
                .allowInsecureHttp(true).maxRetries(0).build(); // en Windows cada rechazo en localhost tarda ~2 s

        failure(await(client(config).postOnce("a", Map.of())), Kind.NETWORK);
    }

    @Test
    void invalidConfigFailsAsNotConfiguredWithoutNetwork() throws Exception {
        ApiClient api = client(ApiClientConfig.builder(url(), "YOUR_API_KEY_HERE").allowInsecureHttp(true).build());

        Failure result = failure(await(api.post("check_player", Map.of())), Kind.NOT_CONFIGURED);

        assertTrue(result.message().contains("ejemplo"), result.message());
        assertEquals(0, hits.get());
        failure(await(api.post("a", Map.of(), Duration.ZERO)), Kind.NOT_CONFIGURED);
    }

    @Test
    void validateConfigListsProblems() {
        assertTrue(ApiClient.validateConfig(ApiClientConfig.builder("https://fg.example/api/plugin.php", KEY).build())
                .isEmpty());
        assertTrue(ApiClient.validateConfig(config().build()).isEmpty(), "http permitido explicitamente");

        assertEquals(1, ApiClient.validateConfig(ApiClientConfig.builder("", KEY).build()).size());
        assertEquals(1, ApiClient.validateConfig(ApiClientConfig.builder("http://fg.example/api.php", KEY).build())
                .size(), "http:// sin permitir");
        assertEquals(1, ApiClient.validateConfig(ApiClientConfig.builder("ftp://fg.example/x", KEY).build()).size());
        assertEquals(1, ApiClient.validateConfig(ApiClientConfig.builder("https://fg.example/x#frag", KEY).build())
                .size());
        for (String placeholder : new String[] {"YOUR_API_KEY_HERE", "TU_API_KEY", "", "  ",
                "YOUR_FURRGUARD_API_KEY_HERE", "your_secure_api_key_here", "changeme", "fg_con espacio"}) {
            assertEquals(1, ApiClient.validateConfig(ApiClientConfig.builder("https://fg.example/x", placeholder)
                    .build()).size(), "clave: '" + placeholder + "'");
        }
        ApiClientConfig badNumbers = ApiClientConfig.builder("https://fg.example/x", KEY)
                .connectTimeout(Duration.ZERO).requestTimeout(Duration.ofSeconds(-1)).maxRetries(-1)
                .maxResponseBytes(0).requestsPerSecond(0).build();
        assertEquals(5, ApiClient.validateConfig(badNumbers).size(), ApiClient.validateConfig(badNumbers).toString());
        assertEquals(1, ApiClient.validateConfig(null).size());
    }

    @Test
    void toStringNeverContainsApiKey() {
        String text = config().build().toString();

        assertFalse(text.contains(KEY), text);
        assertTrue(text.contains("<oculta>"), text);
    }

    @Test
    void closeResolvesPendingCallsAndRejectsNewOnes() throws Exception {
        handler = (exchange, hit) -> {
            Thread.sleep(3_000);
            respond(exchange, 200, "{}");
        };
        ApiClient api = client(config().build());
        CompletableFuture<ApiResult> inFlight = api.post("a", Map.of());
        Thread.sleep(100);

        api.close();

        Failure closed = failure(inFlight.get(1, TimeUnit.SECONDS), Kind.NOT_CONFIGURED);
        assertEquals("cliente cerrado", closed.message());
        failure(await(api.post("a", Map.of())), Kind.NOT_CONFIGURED);
    }

    @Test
    void localLimiterDelaysBurstsAndFailsWhenItCannotWait() throws Exception {
        handler = (exchange, hit) -> respond(exchange, 200, "{}");
        long start = System.nanoTime(); // antes de crear el cubo: el 3er permiso existe >= 500 ms despues
        ApiClient api = client(config().requestsPerSecond(2).build());

        CompletableFuture<ApiResult> first = api.post("a", Map.of());
        CompletableFuture<ApiResult> second = api.post("a", Map.of());
        CompletableFuture<ApiResult> third = api.post("a", Map.of());
        Failure saturated = failure(await(api.post("a", Map.of(), Duration.ofMillis(250))), Kind.RATE_LIMITED);

        assertEquals(0, saturated.status(), "fallo local, sin HTTP");
        assertInstanceOf(Success.class, await(first));
        assertInstanceOf(Success.class, await(second));
        assertInstanceOf(Success.class, await(third), "espera su turno dentro del plazo");
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
        assertTrue(elapsedMillis >= 450, "la rafaga es de 2 a 2/s; fue " + elapsedMillis);
        assertEquals(3, hits.get());
    }
}
