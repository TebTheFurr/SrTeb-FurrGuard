package org.grinch.furrguard.common.http;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * Cliente de las APIs de FurrGuard: {@code POST {baseUrl}?action=<accion>} con cuerpo
 * form-urlencoded y cabecera {@code X-API-Key} (docs/API.md).
 *
 * <ul>
 *   <li>HTTP/1.1, <b>sin seguir redirecciones</b> (la clave nunca viaja a otro destino).</li>
 *   <li>Plazo total por llamada ({@link ApiClientConfig#requestTimeout()}): al vencer, el futuro se
 *       resuelve con {@code TIMEOUT} aunque el servidor siga enviando el cuerpo.</li>
 *   <li>429: respeta {@code Retry-After} (segundos o fecha HTTP) con un bloqueo global; mientras dura,
 *       toda llamada devuelve {@code RATE_LIMITED} al momento sin tocar la red.</li>
 *   <li>Reintentos con backoff exponencial y jitter (~250 ms, ~1 s, ~4 s) ante 5xx, E/S y timeout.
 *       401/403 y el resto de 4xx no se reintentan.</li>
 *   <li>Limitador local token bucket; pool propio de {@value #THREADS} hilos daemon.</li>
 *   <li>Nunca registra nada: ni la clave ni cuerpos. Los futuros nunca se completan con excepcion.</li>
 * </ul>
 *
 * <p>Los callbacks encadenados sin {@code *Async} se ejecutan en los hilos del cliente (o en el hilo
 * de temporizadores de {@link CompletableFuture} si vence el plazo): no bloquees en ellos (ni
 * {@code join()} de otra llamada); para trabajo pesado usa el scheduler de la plataforma.
 */
public final class ApiClient implements AutoCloseable {

    static final int THREADS = 4;
    static final long MAX_RETRY_AFTER_MILLIS = TimeUnit.MINUTES.toMillis(5);
    private static final long DEFAULT_RETRY_AFTER_MILLIS = 5_000;
    private static final long BASE_BACKOFF_MILLIS = 250;
    private static final long MAX_BACKOFF_MILLIS = 4_000;
    private static final long MIN_ATTEMPT_NANOS = TimeUnit.MILLISECONDS.toNanos(200);
    private static final long MAX_TIMEOUT_NANOS = TimeUnit.DAYS.toNanos(1); // evita desbordar nanoTime
    private static final Pattern PLACEHOLDER_KEY = Pattern.compile("(?i)(?:your|tu)_\\w*|change_?me");
    private static final Pattern ERROR_SLUG = Pattern.compile("[a-z0-9_]{1,64}");
    private static final String API_KEY_NOT_CONFIGURED = "api_key_not_configured";
    private static final Pattern DIGITS = Pattern.compile("\\d+");
    private static final Executor INLINE = Runnable::run;
    private static final Failure CLOSED = new Failure(Kind.NOT_CONFIGURED, 0, "cliente cerrado", 0);

    private final ApiClientConfig config;
    private final List<String> problems;
    private final ThreadPoolExecutor executor;
    private final HttpClient http;
    private final TokenBucket limiter;
    private final AtomicLong blockedUntilNanos = new AtomicLong(System.nanoTime());
    private final Set<CompletableFuture<ApiResult>> pending = ConcurrentHashMap.newKeySet();
    private volatile boolean closed;

    /** Nunca lanza por configuracion invalida: las llamadas devolveran {@code NOT_CONFIGURED}. */
    public ApiClient(ApiClientConfig config) {
        this.config = Objects.requireNonNull(config, "config");
        this.problems = validateConfig(config);
        AtomicInteger threadNumber = new AtomicInteger();
        this.executor = new ThreadPoolExecutor(THREADS, THREADS, 30, TimeUnit.SECONDS, new LinkedBlockingQueue<>(),
                runnable -> {
                    Thread thread = new Thread(runnable, "furrguard-http-" + threadNumber.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                });
        executor.allowCoreThreadTimeOut(true);
        HttpClient.Builder builder = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NEVER)
                .executor(executor);
        if (isPositive(config.connectTimeout())) {
            builder.connectTimeout(config.connectTimeout());
        }
        this.http = builder.build();
        this.limiter = new TokenBucket(config.requestsPerSecond(), System::nanoTime);
    }

    public CompletableFuture<ApiResult> post(String action, Map<String, String> form) {
        return submit(action, form, config.requestTimeout(), true);
    }

    /** Con plazo propio, p. ej. para un {@code poll_changes} con {@code wait} largo. */
    public CompletableFuture<ApiResult> post(String action, Map<String, String> form, Duration timeout) {
        return submit(action, form, timeout, true);
    }

    /**
     * Para acciones no idempotentes ({@code record_failed_attempt}, {@code player_disconnect}...): solo
     * reintenta si la peticion no llego a enviarse (conexion rechazada o timeout de conexion), para no
     * contar dos veces algo que el servidor pudo haber procesado.
     */
    public CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form) {
        return submit(action, form, config.requestTimeout(), false);
    }

    /** Problemas legibles de la configuracion; lista vacia si es valida. */
    public static List<String> validateConfig(ApiClientConfig config) {
        if (config == null) {
            return List.of("falta la configuracion de la API");
        }
        List<String> problems = new ArrayList<>();
        String url = config.baseUrl();
        if (url.isEmpty()) {
            problems.add("la URL de la API esta vacia");
        } else {
            URI uri = parseUri(url);
            String scheme = uri == null || uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (uri == null || uri.getHost() == null || uri.getRawFragment() != null
                    || !(scheme.equals("https") || scheme.equals("http"))) {
                problems.add("la URL de la API no es una URL http(s) valida: " + url);
            } else if (scheme.equals("http") && !config.allowInsecureHttp()) {
                problems.add("la URL de la API usa http:// y la clave viajaria sin cifrar; usa https://");
            }
        }
        String key = config.apiKey();
        if (key.isEmpty()) {
            problems.add("la clave de la API esta vacia");
        } else if (PLACEHOLDER_KEY.matcher(key).matches()) {
            problems.add("la clave de la API es el valor de ejemplo; genera una en el panel (Ajustes)");
        } else if (!key.chars().allMatch(c -> c > 0x20 && c < 0x7F)) {
            problems.add("la clave de la API contiene espacios o caracteres no validos");
        }
        if (!config.userAgent().chars().allMatch(c -> c >= 0x20 && c < 0x7F)) {
            problems.add("el User-Agent contiene caracteres no validos");
        }
        if (!isPositive(config.connectTimeout())) {
            problems.add("el timeout de conexion debe ser mayor que 0");
        }
        if (!isPositive(config.requestTimeout())) {
            problems.add("el timeout de peticion debe ser mayor que 0");
        }
        if (config.maxRetries() < 0) {
            problems.add("los reintentos no pueden ser negativos");
        }
        if (config.maxResponseBytes() <= 0) {
            problems.add("el tamano maximo de respuesta debe ser mayor que 0");
        }
        if (!(config.requestsPerSecond() > 0) || Double.isInfinite(config.requestsPerSecond())) {
            problems.add("las peticiones por segundo deben ser un numero mayor que 0");
        }
        return List.copyOf(problems);
    }

    /** Resuelve las llamadas pendientes con {@code NOT_CONFIGURED} ("cliente cerrado") y libera los hilos. */
    @Override
    public void close() {
        closed = true;
        for (CompletableFuture<ApiResult> future : pending) {
            future.complete(CLOSED);
        }
        executor.shutdownNow();
    }

    /** Milisegundos de espera de un {@code Retry-After} (segundos o fecha HTTP), o -1 si no es valido. */
    static long parseRetryAfter(String header, long nowEpochMillis) {
        if (header == null || header.isBlank()) {
            return -1;
        }
        String value = header.strip();
        if (DIGITS.matcher(value).matches()) {
            long seconds = value.length() > 15 ? Long.MAX_VALUE : Long.parseLong(value);
            return Math.min(seconds, Long.MAX_VALUE / 1000) * 1000;
        }
        try {
            long at = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli();
            return Math.max(0, at - nowEpochMillis);
        } catch (DateTimeParseException e) {
            return -1;
        }
    }

    private CompletableFuture<ApiResult> submit(String action, Map<String, String> form, Duration timeout,
                                                boolean idempotent) {
        if (closed) {
            return CompletableFuture.completedFuture(CLOSED);
        }
        if (!problems.isEmpty()) {
            return CompletableFuture.completedFuture(failure(Kind.NOT_CONFIGURED, 0, problems.get(0)));
        }
        if (action == null || action.isBlank() || !isPositive(timeout)) {
            return CompletableFuture.completedFuture(
                    failure(Kind.NOT_CONFIGURED, 0, "accion vacia o timeout de peticion <= 0"));
        }
        String separator = config.baseUrl().contains("?") ? "&" : "?";
        URI uri = URI.create(config.baseUrl() + separator + "action=" + encode(action));
        Call call = new Call(uri, encodeForm(form), saturatedNanos(timeout), idempotent);

        pending.add(call.result);
        call.result.whenComplete((result, error) -> pending.remove(call.result));
        if (closed) { // close() concurrente que ya no vera esta llamada
            call.result.complete(CLOSED);
            return call.result;
        }
        // En el hilo de temporizadores: el plazo se cumple aunque los hilos del cliente esten ocupados
        CompletableFuture.delayedExecutor(call.timeoutNanos, TimeUnit.NANOSECONDS, INLINE).execute(call::expire);
        attempt(call, 0);
        return call.result;
    }

    private void attempt(Call call, int attempt) {
        try {
            if (call.result.isDone()) {
                return;
            }
            long blockedNanos = blockedUntilNanos.get() - System.nanoTime();
            if (blockedNanos > 0) {
                call.result.complete(new Failure(Kind.RATE_LIMITED, 0, "API en pausa por un 429 (Retry-After)",
                        TimeUnit.NANOSECONDS.toMillis(blockedNanos) + 1));
                return;
            }
            long remaining = call.deadlineNanos - System.nanoTime();
            long waitNanos = limiter.reserve(Math.max(0, remaining - MIN_ATTEMPT_NANOS));
            if (waitNanos == TokenBucket.UNAVAILABLE) {
                call.result.complete(new Failure(Kind.RATE_LIMITED, 0, "limitador local saturado",
                        (long) Math.ceil(1000 / config.requestsPerSecond())));
            } else if (waitNanos > 0) {
                CompletableFuture.delayedExecutor(waitNanos, TimeUnit.NANOSECONDS, executor)
                        .execute(() -> send(call, attempt));
            } else {
                send(call, attempt);
            }
        } catch (RuntimeException e) { // p. ej. RejectedExecutionException tras close()
            call.result.complete(failure(Kind.NETWORK, 0, "error interno: " + describe(e)));
        }
    }

    private void send(Call call, int attempt) {
        long remaining = call.deadlineNanos - System.nanoTime();
        if (call.result.isDone() || remaining <= 0) {
            call.expire();
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(call.uri)
                    .timeout(Duration.ofNanos(remaining))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("Accept", "application/json")
                    .header("User-Agent", config.userAgent())
                    .header("X-API-Key", config.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(call.body, StandardCharsets.UTF_8))
                    .build();
            int limit = config.maxResponseBytes();
            CompletableFuture<HttpResponse<byte[]>> exchange =
                    http.sendAsync(request, info -> new LimitedBodySubscriber(limit));
            call.exchange = exchange;
            if (call.result.isDone()) { // vencio mientras se lanzaba
                exchange.cancel(true);
            }
            exchange.whenComplete((response, error) -> onExchange(call, attempt, response, error));
        } catch (RuntimeException e) {
            call.result.complete(failure(Kind.NETWORK, 0, "error interno: " + describe(e)));
        }
    }

    private void onExchange(Call call, int attempt, HttpResponse<byte[]> response, Throwable error) {
        if (call.result.isDone()) {
            return;
        }
        try {
            Outcome outcome = error == null ? fromResponse(response) : fromError(error);
            if (outcome.retryable && (call.idempotent || outcome.notSent) && attempt < config.maxRetries()) {
                long backoffMillis = backoffMillis(attempt);
                long remaining = call.deadlineNanos - System.nanoTime();
                if (remaining - TimeUnit.MILLISECONDS.toNanos(backoffMillis) >= MIN_ATTEMPT_NANOS) {
                    CompletableFuture.delayedExecutor(backoffMillis, TimeUnit.MILLISECONDS, executor)
                            .execute(() -> attempt(call, attempt + 1));
                    return;
                }
            }
            call.result.complete(outcome.result);
        } catch (RuntimeException e) {
            call.result.complete(failure(Kind.NETWORK, 0, "error interno: " + describe(e)));
        }
    }

    private Outcome fromResponse(HttpResponse<byte[]> response) {
        int status = response.statusCode();
        byte[] body = response.body() == null ? new byte[0] : response.body();
        if (status >= 200 && status < 300) {
            JsonElement parsed = parse(body);
            if (parsed != null && parsed.isJsonObject()) {
                return Outcome.done(new Success(status, parsed.getAsJsonObject()));
            }
            return Outcome.done(failure(Kind.INVALID_RESPONSE, status,
                    parsed == null ? "JSON invalido" : "el cuerpo no es un objeto JSON"));
        }
        if (status == 429) {
            long waitMillis = retryAfterMillis(response, body);
            long until = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(waitMillis);
            blockedUntilNanos.accumulateAndGet(until, (current, proposed) -> proposed - current > 0 ? proposed : current);
            return Outcome.done(new Failure(Kind.RATE_LIMITED, status,
                    "HTTP 429: API en pausa " + waitMillis + " ms", waitMillis));
        }
        String slug = errorSlug(body);
        String message = "HTTP " + status + slug;
        if (status == 401 || status == 403) {
            return Outcome.done(failure(Kind.UNAUTHORIZED, status, message));
        }
        // El panel aun no tiene API key (docs/API.md §1.1): es configuracion, no una caida. Sin reintentos
        // y nunca sujeto a failure-policy: allow.
        if (status == 503 && slug.equals(" (" + API_KEY_NOT_CONFIGURED + ")")) {
            return Outcome.done(failure(Kind.NOT_CONFIGURED, status,
                    message + ": el panel no tiene API key; generala en Ajustes y ponla en la configuracion"));
        }
        if (status >= 500 && status < 600) {
            return new Outcome(failure(Kind.SERVER_ERROR, status, message), true, false);
        }
        if (status >= 400 && status < 500) {
            return Outcome.done(failure(Kind.CLIENT_ERROR, status, message));
        }
        return Outcome.done(failure(Kind.INVALID_RESPONSE, status,
                (status >= 300 && status < 400 ? "redireccion rechazada: " : "respuesta inesperada: ") + message));
    }

    private Outcome fromError(Throwable error) {
        LimitedBodySubscriber.TooLargeException tooLarge = find(error, LimitedBodySubscriber.TooLargeException.class);
        if (tooLarge != null) {
            return Outcome.done(failure(Kind.INVALID_RESPONSE, 0, tooLarge.getMessage()));
        }
        boolean notSent = find(error, ConnectException.class) != null;
        if (find(error, HttpConnectTimeoutException.class) != null) {
            return new Outcome(failure(Kind.TIMEOUT, 0, "timeout de conexion"), true, true);
        }
        if (find(error, HttpTimeoutException.class) != null || find(error, CancellationException.class) != null) {
            return new Outcome(failure(Kind.TIMEOUT, 0, "sin respuesta dentro del plazo"), true, false);
        }
        IOException io = find(error, IOException.class);
        if (io != null) {
            return new Outcome(failure(Kind.NETWORK, 0, "error de red: " + describe(io)), true, notSent);
        }
        return Outcome.done(failure(Kind.NETWORK, 0, "error inesperado: " + describe(error)));
    }

    private static long retryAfterMillis(HttpResponse<?> response, byte[] body) {
        long millis = parseRetryAfter(response.headers().firstValue("Retry-After").orElse(null),
                System.currentTimeMillis());
        if (millis < 0) { // sin cabecera valida: campo retry_after (segundos) del cuerpo, o un defecto
            JsonElement parsed = parse(body);
            long seconds = parsed != null && parsed.isJsonObject()
                    ? Json.longValue(parsed.getAsJsonObject(), "retry_after", -1) : -1;
            millis = seconds >= 0 ? Math.min(seconds, MAX_RETRY_AFTER_MILLIS / 1000) * 1000 : DEFAULT_RETRY_AFTER_MILLIS;
        }
        return Math.min(millis, MAX_RETRY_AFTER_MILLIS); // un valor absurdo no bloquea el plugin durante horas
    }

    /** " (slug)" si el cuerpo trae un codigo de error corto ({@code error} o {@code code}); si no, "". */
    private static String errorSlug(byte[] body) {
        JsonElement parsed = parse(body);
        if (parsed != null && parsed.isJsonObject()) {
            for (String field : List.of("error", "code")) {
                String value = Json.str(parsed.getAsJsonObject(), field, null);
                if (value != null && ERROR_SLUG.matcher(value).matches()) {
                    return " (" + value + ")";
                }
            }
        }
        return "";
    }

    private static JsonElement parse(byte[] body) {
        try {
            return JsonParser.parseString(new String(body, StandardCharsets.UTF_8));
        } catch (RuntimeException e) { // JsonParseException, limite de anidamiento...
            return null;
        }
    }

    private static long backoffMillis(int attempt) {
        long nominal = Math.min(MAX_BACKOFF_MILLIS, BASE_BACKOFF_MILLIS << Math.min(2 * attempt, 20));
        return (long) (nominal * (0.75 + ThreadLocalRandom.current().nextDouble() * 0.5));
    }

    private static <T extends Throwable> T find(Throwable error, Class<T> type) {
        Throwable current = error;
        for (int depth = 0; current != null && depth < 16; depth++, current = current.getCause()) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
        }
        return null;
    }

    private static String encodeForm(Map<String, String> form) {
        StringJoiner body = new StringJoiner("&");
        if (form != null) {
            form.forEach((key, value) -> body.add(encode(key) + "=" + encode(value)));
        }
        return body.toString();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static URI parseUri(String url) {
        try {
            return new URI(url);
        } catch (URISyntaxException e) {
            return null;
        }
    }

    private static boolean isPositive(Duration duration) {
        return duration != null && !duration.isNegative() && !duration.isZero();
    }

    private static long saturatedNanos(Duration duration) {
        try {
            return Math.min(duration.toNanos(), MAX_TIMEOUT_NANOS);
        } catch (ArithmeticException e) {
            return MAX_TIMEOUT_NANOS;
        }
    }

    private static Failure failure(Kind kind, int status, String message) {
        return new Failure(kind, status, message, 0);
    }

    private static String describe(Throwable error) {
        String message = error.getMessage();
        return error.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
    }

    private record Outcome(ApiResult result, boolean retryable, boolean notSent) {
        static Outcome done(ApiResult result) {
            return new Outcome(result, false, false);
        }
    }

    private static final class Call {
        final URI uri;
        final String body;
        final long timeoutNanos;
        final long deadlineNanos;
        final boolean idempotent;
        final CompletableFuture<ApiResult> result = new CompletableFuture<>();
        volatile CompletableFuture<?> exchange;

        Call(URI uri, String body, long timeoutNanos, boolean idempotent) {
            this.uri = uri;
            this.body = body;
            this.timeoutNanos = timeoutNanos;
            this.deadlineNanos = System.nanoTime() + timeoutNanos;
            this.idempotent = idempotent;
        }

        /** Resuelve con TIMEOUT (si nada lo resolvio antes) y aborta el intercambio en curso. */
        void expire() {
            result.complete(new Failure(Kind.TIMEOUT, 0,
                    "sin respuesta en " + TimeUnit.NANOSECONDS.toMillis(timeoutNanos) + " ms", 0));
            CompletableFuture<?> current = exchange;
            if (current != null && !current.isDone()) {
                current.cancel(true);
            }
        }
    }
}
