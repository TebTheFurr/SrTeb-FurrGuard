package org.grinch.furrpermsModule;

import com.google.inject.Inject;
import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import org.grinch.furrpermsModule.api.ApiClient;
import org.grinch.furrpermsModule.config.Config;
import org.grinch.furrpermsModule.listener.CommandListener;
import org.grinch.furrpermsModule.util.MessageUtil;
import org.slf4j.Logger;

import java.nio.file.Path;

@Plugin(
        id = "furrperms-module",
        name = "FurrPerms Module",
        version = BuildConstants.VERSION,
        description = "Módulo de protección de comandos sensibles para FurrGuard",
        authors = {"GrinchHorizon"},
        url = "https://srteb.eu"
)
public class FurrpermsModule {

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;

    private Config config;
    private ApiClient apiClient;
    private MessageUtil messageUtil;

    private static FurrpermsModule instance;

    @Inject
    public FurrpermsModule(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
        instance = this;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        logger.info("╔═══════════════════════════════════════╗");
        logger.info("║       FurrPerms Module v" + BuildConstants.VERSION + "         ║");
        logger.info("║    Protección de Comandos Sensibles   ║");
        logger.info("║      (c) SrTeb Limited - srteb.eu     ║");
        logger.info("╚═══════════════════════════════════════╝");

        loadConfig();

        if (!config.isEnabled()) {
            logger.warn("FurrPerms está desactivado en la configuración.");
            return;
        }

        this.apiClient = new ApiClient(this);
        this.messageUtil = new MessageUtil(this);

        // Cargar mensajes desde la API
        try {
            messageUtil.loadMessages();
        } catch (Exception e) {
            logger.warn("No se pudieron cargar los mensajes desde la API, usando defaults.");
        }

        // Registrar listener de comandos
        server.getEventManager().register(this, new CommandListener(this));
        logger.info("Listener de comandos registrado.");

        logger.info("FurrPerms iniciado correctamente.");
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        logger.info("FurrPerms desactivado.");
    }

    private void loadConfig() {
        this.config = new Config(this);
        config.load();
        logger.info("Configuración cargada.");
    }

    public void reload() {
        loadConfig();
        if (apiClient != null) {
            messageUtil.loadMessages();
        }
        logger.info("Configuración recargada.");
    }

    public static FurrpermsModule getInstance() {
        return instance;
    }

    public ProxyServer getServer() {
        return server;
    }

    public Logger getLogger() {
        return logger;
    }

    public Path getDataDirectory() {
        return dataDirectory;
    }

    public Config getConfig() {
        return config;
    }

    public ApiClient getApiClient() {
        return apiClient;
    }

    public MessageUtil getMessageUtil() {
        return messageUtil;
    }
}
