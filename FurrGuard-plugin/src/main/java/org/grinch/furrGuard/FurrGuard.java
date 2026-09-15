package org.grinch.furrGuard;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.event.EventTask;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.grinch.furrGuard.api.CheckCache;
import org.grinch.furrGuard.api.PluginApi;
import org.grinch.furrGuard.command.FurrGuardCommand;
import org.grinch.furrGuard.config.PluginConfig;
import org.grinch.furrGuard.license.LicenseManager;
import org.grinch.furrGuard.listener.ConnectionListener;
import org.grinch.furrGuard.sync.ChangeWatcher;
import org.grinch.furrGuard.text.Messages;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Plugin(
        id = "furrguard",
        name = "FurrGuard",
        version = BuildConstants.VERSION,
        description = "Sistema de seguridad anti-proxy/VPN/hosting para Minecraft",
        authors = {"GrinchHorizon"},
        url = "https://tebby.lgbt"
)
public class FurrGuard {

    /** Lo que el listener hace con un login. */
    public enum Readiness {
        /** Licencia valida (o en gracia) y configuracion valida: se comprueba cada login. */
        READY,
        /** Verificando la licencia: se deniega con "servidor iniciando". */
        STARTING,
        UNLICENSED,
        /** Nunca hubo una config.yml valida: se deniega con "servidor iniciando". */
        CONFIG_ERROR,
        /** {@code enabled: false}: no se comprueba nada. */
        DISABLED
    }

    /** Foto coherente de configuracion, cliente y disponibilidad. {@code config}/{@code api} pueden ser null. */
    public record State(PluginConfig config, PluginApi api, Readiness readiness) {
    }

    private record Active(PluginConfig config, PluginApi api) {
    }

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private final CheckCache cache = new CheckCache();

    private volatile Messages messages = new Messages(Map.of());
    private volatile Active active;
    private volatile LicenseManager license;
    private volatile ScheduledTask pollTask;
    private ConnectionListener listener;
    private ChangeWatcher watcher;

    @Inject
    public FurrGuard(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        logger.info("FurrGuard v{} by GrinchHorizon - anti-proxy/VPN/hosting", BuildConstants.VERSION);
        try {
            messages = Messages.fromResource(getClass().getClassLoader());
        } catch (RuntimeException e) {
            logger.error("No se pudieron cargar los mensajes por defecto ({}): {}", Messages.RESOURCE, e.getMessage());
        }

        // Primero listeners y comandos: hasta estar listo, cada login se deniega en vez de pasar sin comprobar
        listener = new ConnectionListener(this);
        watcher = new ChangeWatcher(this, listener);
        server.getEventManager().register(this, listener);
        CommandManager commands = server.getCommandManager();
        commands.register(commands.metaBuilder("furrguard").aliases("fg", "guard").plugin(this).build(),
                new FurrGuardCommand(this));

        PluginConfig.Loaded loaded = loadConfig();
        if (loaded.ok()) {
            applyConfig(loaded.config());
        } else {
            logProblems("config.yml no es valida: se deniegan todos los logins hasta corregirla y usar /fg reload",
                    loaded.problems());
        }

        LicenseManager manager = new LicenseManager(this, server, logger, dataDirectory);
        license = manager;
        manager.start();
        server.getScheduler().buildTask(this, this::sweep).repeat(1, TimeUnit.MINUTES).schedule();
        logger.info("Listeners y comandos registrados: /furrguard, /fg, /guard");
    }

    /** Los jugadores se desconectan antes de este evento: sus player_quit tienen 3 s para salir. */
    @Subscribe
    public EventTask onProxyShutdown(ProxyShutdownEvent event) {
        LicenseManager manager = license;
        if (manager != null) {
            manager.shutdown();
        }
        CompletableFuture<Void> quits = listener == null
                ? CompletableFuture.completedFuture(null)
                : listener.pendingQuits().completeOnTimeout(null, 3, TimeUnit.SECONDS);
        return EventTask.resumeWhenComplete(quits.handle((ignored, error) -> {
            Active current = active;
            if (current != null && current.api() != null) {
                current.api().close();
            }
            logger.info("FurrGuard desactivado.");
            return null;
        }));
    }

    public State state() {
        Active current = active;
        LicenseManager manager = license;
        Readiness readiness;
        if (current == null) {
            readiness = Readiness.CONFIG_ERROR;
        } else if (!current.config().enabled()) {
            readiness = Readiness.DISABLED;
        } else if (manager == null) {
            readiness = Readiness.STARTING;
        } else {
            readiness = switch (manager.status()) {
                case VALID, GRACE -> Readiness.READY;
                case PENDING -> Readiness.STARTING;
                case UNLICENSED -> Readiness.UNLICENSED;
            };
        }
        return current == null
                ? new State(null, null, readiness)
                : new State(current.config(), current.api(), readiness);
    }

    /**
     * Relee config.yml (llamar fuera de hilos de eventos). Si no es valida se conserva la anterior.
     *
     * @return los problemas encontrados; vacia si se aplico
     */
    public List<String> reload() {
        PluginConfig.Loaded loaded = loadConfig();
        if (!loaded.ok()) {
            logProblems("/fg reload: config.yml no es valida, se mantiene la configuracion anterior", loaded.problems());
            return loaded.problems();
        }
        applyConfig(loaded.config());
        logger.info("Configuracion recargada.");
        return List.of();
    }

    /** A los jugadores con furrguard.notify o furrguard.admin, y a la consola sin colores. */
    public void broadcastToAdmins(Component message) {
        int receivers = 0;
        for (Player player : server.getAllPlayers()) {
            if (player.hasPermission("furrguard.notify") || player.hasPermission("furrguard.admin")) {
                player.sendMessage(message);
                receivers++;
            }
        }
        logger.info("[FG] Aviso a admins ({} receptores): {}", receivers,
                PlainTextComponentSerializer.plainText().serialize(message));
    }

    private PluginConfig.Loaded loadConfig() {
        return PluginConfig.load(dataDirectory.resolve(PluginConfig.RESOURCE), getClass().getClassLoader());
    }

    private synchronized void applyConfig(PluginConfig config) {
        Active previous = active;
        active = new Active(config, config.enabled() ? new PluginApi(config.api(), config.debug(), logger) : null);
        cache.clear();
        watcher.reset(); // el siguiente poll recarga mensajes y ajustes con el cliente nuevo

        ScheduledTask oldPoll = pollTask;
        if (oldPoll != null) {
            oldPoll.cancel();
        }
        pollTask = server.getScheduler().buildTask(this, watcher::tick)
                .repeat(config.pollInterval().toMillis(), TimeUnit.MILLISECONDS)
                .schedule();

        if (previous != null && previous.api() != null) { // deja terminar las llamadas en vuelo
            long grace = previous.api().config().requestTimeout().toMillis() + 1000;
            server.getScheduler().buildTask(this, previous.api()::close).delay(grace, TimeUnit.MILLISECONDS).schedule();
        }
        if (!config.enabled()) {
            logger.warn("FurrGuard esta desactivado en config.yml (enabled: false): los logins no se comprueban.");
        }
    }

    private void sweep() {
        cache.sweep();
        listener.sweep();
    }

    private void logProblems(String headline, List<String> problems) {
        logger.error(headline);
        problems.forEach(problem -> logger.error("  - {}", problem));
    }

    public ProxyServer getServer() {
        return server;
    }

    public Logger getLogger() {
        return logger;
    }

    public Messages messages() {
        return messages;
    }

    public CheckCache cache() {
        return cache;
    }

    public LicenseManager license() {
        return license;
    }

    public ConnectionListener listener() {
        return listener;
    }

    public ChangeWatcher watcher() {
        return watcher;
    }
}
