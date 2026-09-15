package org.grinch.furrGuard.license;

import com.google.gson.JsonObject;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import org.grinch.furrGuard.BuildConstants;
import org.grinch.furrGuard.license.LicenseResponses.LicenseInfo;
import org.grinch.furrGuard.license.LicenseResponses.LinkStatus;
import org.grinch.furrGuard.license.LicenseResponses.Verification;
import org.slf4j.Logger;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * Licencia FurrDownloads (vinculacion OAuth con codigo).
 *
 * <ul>
 *   <li>La clave solo se borra ante un rechazo explicito ({@link LicenseResponses.Verdict#INVALID}).</li>
 *   <li>Si el servidor de licencias no responde, se reintenta con backoff y la red sigue abierta
 *       {@link LicenseResponses#GRACE_PERIOD} desde la ultima verificacion correcta.</li>
 *   <li>Cada paso corre en el scheduler de Velocity y programa el siguiente: nunca hay dos a la vez
 *       ni se bloquea un hilo de eventos. El estado es volatil y el resto del plugin solo lo consulta.</li>
 * </ul>
 */
public final class LicenseManager {

    public enum Status {
        /** Aun sin veredicto, o sin respuesta del servidor y fuera del periodo de gracia. */
        PENDING,
        VALID,
        /** Sin respuesta del servidor de licencias, dentro del periodo de gracia. */
        GRACE,
        /** Sin clave, o clave rechazada: esperando vinculacion. */
        UNLICENSED
    }

    private static final String PLUGIN_ID = "furrguard";
    private static final String API_URL = "https://furrdownloads.srteb.eu/api";
    private static final String LINK_URL = "https://furrdownloads.srteb.eu/link/";
    private static final String USER_AGENT = "FurrGuard-Velocity/" + BuildConstants.VERSION;
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration REVERIFY_EVERY = Duration.ofHours(6);
    private static final Duration HEARTBEAT_EVERY = Duration.ofMinutes(5);
    private static final Duration LINK_POLL_EVERY = Duration.ofSeconds(10);
    private static final int LINK_POLL_ATTEMPTS = 30; // 5 minutos: lo que dura un codigo
    private static final long[] BACKOFF_SECONDS = {15, 30, 60, 120, 300, 600};

    /** {@code status} 0: sin respuesta, descrita en {@code error}. */
    record Response(int status, String body, String error) {
    }

    private final Object plugin;
    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final Function<HttpRequest, Response> transport;

    private volatile Status status = Status.PENDING;
    private volatile LicenseInfo license;
    private volatile long lastValidAt;
    private volatile String apiKey;
    private volatile String hwid;
    private volatile int failures;
    private volatile boolean updateChecked;
    private volatile boolean closed;
    private volatile ScheduledTask nextStep;
    private volatile ScheduledTask heartbeat;

    public LicenseManager(Object plugin, ProxyServer server, Logger logger, Path dataDirectory) {
        this(plugin, server, logger, dataDirectory, null);
    }

    /** {@code transport} null usa HTTP real; los tests pasan uno falso (la URL no es configurable). */
    LicenseManager(Object plugin, ProxyServer server, Logger logger, Path dataDirectory,
                   Function<HttpRequest, Response> transport) {
        this.plugin = plugin;
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
        this.transport = transport != null ? transport : this::exchange;
    }

    public void start() {
        schedule(Duration.ZERO, this::boot);
        heartbeat = server.getScheduler().buildTask(plugin, this::sendHeartbeat)
                .delay(HEARTBEAT_EVERY).repeat(HEARTBEAT_EVERY).schedule();
    }

    public void shutdown() {
        closed = true;
        cancel(nextStep);
        cancel(heartbeat);
    }

    public Status status() {
        return status;
    }

    public boolean isLicensed() {
        Status current = status;
        return current == Status.VALID || current == Status.GRACE;
    }

    /** Titular de la licencia, o null si nunca se verifico. */
    public String holder() {
        LicenseInfo info = license;
        return info == null ? null : info.discordUsername();
    }

    public String role() {
        LicenseInfo info = license;
        return info == null ? null : info.role();
    }

    private void boot() {
        hwid = loadHwid();
        try {
            apiKey = LicenseFiles.readKey(dataDirectory);
        } catch (IOException e) {
            logger.error("No se pudo leer el archivo key: {}", e.getMessage());
        }
        if (apiKey == null) {
            status = Status.UNLICENSED;
            logger.warn("No hay licencia vinculada: se deniegan los logins hasta completar la vinculacion.");
            startLinking();
            return;
        }
        LicenseFiles.SavedState saved = LicenseFiles.readState(dataDirectory);
        if (saved != null) {
            lastValidAt = saved.lastValidAt();
            if (LicenseResponses.withinGrace(lastValidAt, System.currentTimeMillis())) {
                license = saved.license();
                status = Status.GRACE; // la red no espera al servidor de licencias para abrir
            }
        }
        verify();
    }

    private void verify() {
        logger.info("Verificando licencia...");
        Response response = post("/plugin/verify", json("api_key", apiKey, "hwid", hwid));
        Verification verification = response.status() == 0
                ? new Verification(LicenseResponses.Verdict.RETRY, null, "sin respuesta: " + response.error())
                : LicenseResponses.parseVerify(response.status(), response.body());
        if (verification.verdict() == LicenseResponses.Verdict.VALID) {
            onValid(verification.license());
        } else if (LicenseResponses.shouldDeleteKey(verification)) {
            onRejected(verification.error());
        } else {
            onVerifyFailed(verification.error());
        }
    }

    private void onValid(LicenseInfo info) {
        boolean wasValid = status == Status.VALID;
        license = info;
        lastValidAt = System.currentTimeMillis();
        failures = 0;
        status = Status.VALID;
        try {
            LicenseFiles.writeState(dataDirectory, lastValidAt, info);
        } catch (IOException e) {
            logger.warn("No se pudo guardar {} ({}): sin el no habra periodo de gracia al reiniciar",
                    LicenseFiles.STATE_FILE, e.getMessage());
        }
        if (!wasValid) {
            logger.info("Licencia valida: {} | titular: {} | rol: {} | servidores: {}/{} | {}",
                    info.pluginName(), info.discordUsername(), info.role(), info.activeServers(), info.maxServers(),
                    info.lifetime() ? "lifetime" : "expira: " + info.expiresAt());
        }
        if (!updateChecked) {
            updateChecked = true;
            checkForUpdates();
        }
        schedule(REVERIFY_EVERY, this::verify);
    }

    private void onRejected(String error) {
        logger.error("El servidor de licencias rechazo la clave ({}): se borra y hay que vincular de nuevo.", error);
        try {
            LicenseFiles.deleteKeyAndState(dataDirectory);
        } catch (IOException e) {
            logger.error("No se pudo borrar el archivo key: {}", e.getMessage());
        }
        apiKey = null;
        license = null;
        lastValidAt = 0;
        status = Status.UNLICENSED;
        startLinking();
    }

    private void onVerifyFailed(String error) {
        Duration delay = backoff();
        if (LicenseResponses.withinGrace(lastValidAt, System.currentTimeMillis())) {
            if (status != Status.GRACE) {
                logger.warn("Servidor de licencias sin respuesta: periodo de gracia hasta {} (UTC)",
                        Instant.ofEpochMilli(lastValidAt).plus(LicenseResponses.GRACE_PERIOD));
            }
            status = Status.GRACE;
        } else {
            if (status == Status.GRACE || status == Status.VALID) {
                logger.error("Periodo de gracia agotado: se deniegan los logins hasta verificar la licencia.");
            }
            status = Status.PENDING;
        }
        logger.warn("No se pudo verificar la licencia ({}); reintento en {} s", error, delay.toSeconds());
        schedule(delay, this::verify);
    }

    private void startLinking() {
        JsonObject serverInfo = json("name", "FurrGuard", "version", BuildConstants.VERSION);
        serverInfo.addProperty("platform", "velocity");
        JsonObject body = json("plugin_id", PLUGIN_ID, "hwid", hwid);
        body.add("server_info", serverInfo);
        Response response = post("/plugin/link", body);
        Optional<String> code = LicenseResponses.parseLinkCode(response.status(), response.body());
        if (code.isEmpty()) {
            Duration delay = backoff();
            logger.error("No se pudo iniciar la vinculacion ({}); reintento en {} s", describe(response), delay.toSeconds());
            schedule(delay, this::startLinking);
            return;
        }
        failures = 0;
        logger.warn("====================================================================");
        logger.warn(" VINCULACION REQUERIDA - VERIFICACION CON DISCORD");
        logger.warn(" Mientras no se vincule, el proxy deniega todos los logins.");
        logger.warn(" Codigo de vinculacion: {} (caduca en 5 minutos; despues se genera otro)", code.get());
        logger.warn(" Abre en el navegador: {}{}?redirect=false", LINK_URL, code.get());
        logger.warn("====================================================================");
        schedule(LINK_POLL_EVERY, () -> pollLink(code.get(), 1));
    }

    private void pollLink(String code, int attempt) {
        Response response = get("/plugin/link/status/" + code);
        LinkStatus link = LicenseResponses.parseLinkStatus(response.status(), response.body());
        if (link.completed()) {
            try {
                LicenseFiles.writeKey(dataDirectory, link.encryptedKey(), link.instanceId());
            } catch (IOException e) {
                logger.error("No se pudo guardar el archivo key ({}): habra que vincular de nuevo al reiniciar",
                        e.getMessage());
            }
            apiKey = link.encryptedKey();
            logger.info("Servidor vinculado correctamente.");
            verify();
        } else if (link.expired() || attempt >= LINK_POLL_ATTEMPTS) {
            logger.warn("El codigo de vinculacion ha caducado: se genera uno nuevo.");
            startLinking();
        } else {
            schedule(LINK_POLL_EVERY, () -> pollLink(code, attempt + 1));
        }
    }

    private void sendHeartbeat() {
        String key = apiKey;
        if (!closed && key != null && isLicensed()) {
            post("/plugin/heartbeat", json("api_key", key, null, null)); // la respuesta no cambia el estado
        }
    }

    private void checkForUpdates() {
        Response response = post("/plugin/check-version",
                json("plugin_id", PLUGIN_ID, "current_version", BuildConstants.VERSION));
        LicenseResponses.parseUpdate(response.status(), response.body()).ifPresent(update ->
                logger.warn("Nueva version de FurrGuard disponible: {} (actual: {}). Descarga: {}",
                        update.latestVersion(), BuildConstants.VERSION, update.downloadUrl()));
    }

    private String loadHwid() {
        try {
            return LicenseFiles.loadOrCreateHwid(dataDirectory, this::computeHwid);
        } catch (IOException e) {
            logger.warn("No se pudo guardar {} ({}): se recalcula en cada arranque", LicenseFiles.HWID_FILE,
                    e.getMessage());
            return computeHwid();
        }
    }

    /** Formula de 1.x: solo se usa la primera vez; despues manda el archivo hwid. */
    private String computeHwid() {
        InetSocketAddress bind = server.getBoundAddress();
        return LicenseFiles.sha256Hex(System.getProperty("os.name") + System.getProperty("os.version")
                + System.getProperty("os.arch") + System.getProperty("java.version")
                + bind.getHostString() + bind.getPort() + "furrdownloads-hwid-salt-velocity");
    }

    private Response post(String path, JsonObject body) {
        return send(HttpRequest.newBuilder(URI.create(API_URL + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString())));
    }

    private Response get(String path) {
        return send(HttpRequest.newBuilder(URI.create(API_URL + path)).GET());
    }

    private Response send(HttpRequest.Builder builder) {
        return transport.apply(builder.timeout(HTTP_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/json")
                .build());
    }

    /** Bloqueante a proposito: solo se llama desde tareas del scheduler. */
    private Response exchange(HttpRequest request) {
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return new Response(response.statusCode(), response.body(), null);
        } catch (IOException e) {
            return new Response(0, null, e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Response(0, null, "interrumpido");
        }
    }

    private void schedule(Duration delay, Runnable step) {
        if (closed) {
            return;
        }
        nextStep = server.getScheduler().buildTask(plugin, () -> runStep(step))
                .delay(delay.toMillis(), TimeUnit.MILLISECONDS)
                .schedule();
    }

    private void runStep(Runnable step) {
        if (closed) {
            return;
        }
        try {
            step.run();
        } catch (RuntimeException e) {
            logger.error("Error inesperado gestionando la licencia; se reintenta", e);
            Runnable retry = hwid == null ? this::boot : apiKey != null ? this::verify : this::startLinking;
            schedule(backoff(), retry);
        }
    }

    private Duration backoff() {
        int attempt = Math.min(failures, BACKOFF_SECONDS.length - 1);
        failures = attempt + 1;
        double jitter = 0.8 + ThreadLocalRandom.current().nextDouble() * 0.4;
        return Duration.ofMillis((long) (BACKOFF_SECONDS[attempt] * 1000 * jitter));
    }

    private static String describe(Response response) {
        return response.status() == 0 ? "sin respuesta: " + response.error() : "HTTP " + response.status();
    }

    private static JsonObject json(String key, String value, String key2, String value2) {
        JsonObject json = new JsonObject();
        json.addProperty(key, value);
        if (key2 != null) {
            json.addProperty(key2, value2);
        }
        return json;
    }

    private static void cancel(ScheduledTask task) {
        if (task != null) {
            task.cancel();
        }
    }
}
