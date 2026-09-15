package org.grinch.furrGuard.license;

import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import com.velocitypowered.api.scheduler.Scheduler;
import com.velocitypowered.api.scheduler.TaskStatus;
import org.grinch.furrGuard.license.LicenseManager.Response;
import org.grinch.furrGuard.license.LicenseManager.Status;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.helpers.NOPLogger;

import java.io.IOException;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Maquina de estados de C6 con un scheduler manual y un servidor de licencias falso. */
class LicenseManagerTest {

    private static final Response OUTAGE = new Response(503, "<html>Service Unavailable</html>", null);
    private static final Response NO_NETWORK = new Response(0, null, "ConnectException");

    @TempDir
    Path dir;

    private final Deque<Runnable> pendingSteps = new ArrayDeque<>();
    private final List<String> calls = new ArrayList<>();

    @Test
    void outageWithRecentStateKeepsTheKeyAndTheNetworkOpen() throws IOException {
        writeKey();
        LicenseFiles.writeState(dir, System.currentTimeMillis() - 3_600_000, info());
        LicenseManager manager = start(Map.of("/api/plugin/verify", OUTAGE));

        runSteps(1);

        assertEquals(Status.GRACE, manager.status());
        assertTrue(manager.isLicensed());
        assertTrue(Files.exists(dir.resolve(LicenseFiles.KEY_FILE)));
        assertEquals(1, pendingSteps.size()); // reintento con backoff ya programado
    }

    @Test
    void outageWithoutRecentStateDeniesButNeverDeletesTheKey() throws IOException {
        writeKey();
        LicenseManager manager = start(Map.of("/api/plugin/verify", NO_NETWORK));

        runSteps(3); // arranque y dos reintentos

        assertEquals(Status.PENDING, manager.status());
        assertFalse(manager.isLicensed());
        assertTrue(Files.exists(dir.resolve(LicenseFiles.KEY_FILE)));
        assertEquals(List.of("/api/plugin/verify", "/api/plugin/verify", "/api/plugin/verify"), calls);
    }

    @Test
    void retryableRejectionIsNeitherValidNorDeleted() throws IOException {
        writeKey();
        LicenseManager manager = start(Map.of("/api/plugin/verify",
                new Response(200, "{\"success\":false,\"error\":\"db\",\"can_retry\":true}", null)));

        runSteps(1);

        assertEquals(Status.PENDING, manager.status());
        assertTrue(Files.exists(dir.resolve(LicenseFiles.KEY_FILE)));
    }

    @Test
    void explicitRejectionDeletesTheKeyAndStartsLinking() throws IOException {
        writeKey();
        LicenseFiles.writeState(dir, System.currentTimeMillis(), info());
        LicenseManager manager = start(Map.of(
                "/api/plugin/verify", new Response(403, "{\"success\":false,\"error\":\"license_revoked\"}", null),
                "/api/plugin/link", new Response(200, "{\"success\":true,\"link_code\":\"ABC123\"}", null)));

        runSteps(1);

        assertEquals(Status.UNLICENSED, manager.status()); // sin gracia: el rechazo es explicito
        assertFalse(Files.exists(dir.resolve(LicenseFiles.KEY_FILE)));
        assertFalse(Files.exists(dir.resolve(LicenseFiles.STATE_FILE)));
        assertEquals(List.of("/api/plugin/verify", "/api/plugin/link"), calls);
    }

    @Test
    void validLicenseStoresTheGraceBaselineAndTheHwid() throws IOException {
        writeKey();
        LicenseManager manager = start(Map.of(
                "/api/plugin/verify", new Response(200,
                        "{\"success\":true,\"license\":{\"discord_username\":\"grinch\",\"is_lifetime\":true}}", null),
                "/api/plugin/check-version", new Response(200, "{\"has_update\":false}", null)));

        runSteps(1);

        assertEquals(Status.VALID, manager.status());
        assertEquals("grinch", manager.holder());
        LicenseFiles.SavedState state = LicenseFiles.readState(dir);
        assertNotNull(state);
        assertTrue(System.currentTimeMillis() - state.lastValidAt() < 60_000);
        assertTrue(Files.exists(dir.resolve(LicenseFiles.HWID_FILE)));
    }

    @Test
    void completedLinkSavesTheKeyAndVerifies() {
        LicenseManager manager = start(Map.of(
                "/api/plugin/link", new Response(200, "{\"success\":true,\"link_code\":\"ABC123\"}", null),
                "/api/plugin/link/status/ABC123", new Response(200,
                        "{\"status\":\"completed\",\"api_key_encrypted\":\"enc==\",\"instance_id\":\"i-1\"}", null),
                "/api/plugin/verify", new Response(200, "{\"success\":true}", null),
                "/api/plugin/check-version", new Response(200, "{}", null)));

        runSteps(2); // arranque sin clave -> vinculacion; primer sondeo -> completada

        assertEquals(Status.VALID, manager.status());
        assertTrue(Files.exists(dir.resolve(LicenseFiles.KEY_FILE)));
    }

    private LicenseManager start(Map<String, Response> routes) {
        LicenseManager manager = new LicenseManager(this, fakeServer(), NOPLogger.NOP_LOGGER, dir, request -> {
            String path = request.uri().getPath();
            calls.add(path);
            return routes.getOrDefault(path, new Response(404, "{}", null));
        });
        manager.start();
        return manager;
    }

    private void runSteps(int count) {
        for (int i = 0; i < count; i++) {
            pendingSteps.removeFirst().run();
        }
    }

    private void writeKey() throws IOException {
        LicenseFiles.writeKey(dir, "encrypted-key", "i-1");
    }

    private static LicenseResponses.LicenseInfo info() {
        return new LicenseResponses.LicenseInfo("FurrGuard", "grinch", "owner", 1, 1, true, null);
    }

    /** ProxyServer con solo scheduler (manual: cada tarea no repetitiva espera a runSteps) y bind. */
    private ProxyServer fakeServer() {
        Scheduler scheduler = new Scheduler() {
            @Override
            public TaskBuilder buildTask(Object plugin, Runnable runnable) {
                return new ManualBuilder(runnable);
            }

            @Override
            public TaskBuilder buildTask(Object plugin, Consumer<ScheduledTask> task) {
                throw new UnsupportedOperationException();
            }

            @Override
            public Collection<ScheduledTask> tasksByPlugin(Object plugin) {
                return List.of();
            }
        };
        return (ProxyServer) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{ProxyServer.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getScheduler" -> scheduler;
                    case "getBoundAddress" -> new InetSocketAddress("127.0.0.1", 25565);
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    private final class ManualBuilder implements Scheduler.TaskBuilder {
        private final Runnable runnable;
        private boolean repeating;

        ManualBuilder(Runnable runnable) {
            this.runnable = runnable;
        }

        @Override
        public Scheduler.TaskBuilder delay(long time, TimeUnit unit) {
            return this;
        }

        @Override
        public Scheduler.TaskBuilder repeat(long time, TimeUnit unit) {
            repeating = true;
            return this;
        }

        @Override
        public Scheduler.TaskBuilder clearDelay() {
            return this;
        }

        @Override
        public Scheduler.TaskBuilder clearRepeat() {
            repeating = false;
            return this;
        }

        @Override
        public ScheduledTask schedule() {
            if (!repeating) { // el latido no interesa aqui
                pendingSteps.addLast(runnable);
            }
            return new ScheduledTask() {
                @Override
                public Object plugin() {
                    return LicenseManagerTest.this;
                }

                @Override
                public TaskStatus status() {
                    return TaskStatus.SCHEDULED;
                }

                @Override
                public void cancel() {
                    pendingSteps.remove(runnable);
                }
            };
        }
    }
}
