package org.grinch.furrGuard;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.PreLoginEvent;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextColor;
import org.grinch.furrGuard.api.ApiClient;
import org.grinch.furrGuard.command.FurrGuardCommand;
import org.grinch.furrGuard.config.Config;
import org.grinch.furrGuard.listener.ConnectionListener;
import org.grinch.furrGuard.license.LicenseManager;
import org.grinch.furrGuard.util.MessageUtil;
import org.slf4j.Logger;

import java.nio.file.Path;

@Plugin(
        id = "furrguard",
        name = "FurrGuard",
        version = BuildConstants.VERSION,
        description = "Sistema de seguridad anti-proxy/VPN/hosting para Minecraft",
        authors = {"GrinchHorizon"},
        url = "https://srteb.eu"
)
public class FurrGuard {

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;

    private Config config;
    private ApiClient apiClient;
    private MessageUtil messageUtil;
    private LicenseManager licenseManager;

    private static FurrGuard instance;
    private static final TextColor ACCENT_COLOR = TextColor.color(0x00FFAA);

    @Inject
    public FurrGuard(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
        instance = this;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        printStartupBanner();

        loadConfig();

        if (!config.isEnabled()) {
            logger.warn("FurrGuard está desactivado en la configuración.");
            return;
        }

        this.licenseManager = new LicenseManager(this, logger, server, dataDirectory);
        licenseManager.verifyLicense();

        this.apiClient = new ApiClient(this);
        this.messageUtil = new MessageUtil(this);

        licenseManager.onLicenseValid(() -> {
            if (!testApiConnection()) {
                logger.warn("No se pudo conectar con la API de verificación IP.");
            }

            loadMessages();
            registerListeners();
            registerCommands();

            printReadyBanner();
        });
    }

    private void printStartupBanner() {
        logger.info("");
        logger.info("  \u001B[1;92mFurrGuard v{}\u001B[0m \u001B[90mby GrinchHorizon\u001B[0m", BuildConstants.VERSION);
        logger.info("  \u001B[90mSistema de Seguridad Anti-Proxy/VPN/Hosting\u001B[0m");
        logger.info("");
    }

    private void printReadyBanner() {
        logger.info("");
        logger.info("  \u001B[32m✔ FurrGuard iniciado correctamente\u001B[0m");
        logger.info("  \u001B[90m  • API: Conectada\u001B[0m");
        logger.info("  \u001B[90m  • Licencia: Verificada\u001B[0m");
        logger.info("  \u001B[90m  • Comandos: /furrguard, /fg, /guard\u001B[0m");
        logger.info("");
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (apiClient != null) {
            apiClient.shutdown();
        }
        if (licenseManager != null) {
            licenseManager.shutdown();
        }
        logger.info("FurrGuard desactivado.");
    }

    private void loadConfig() {
        this.config = new Config(this);
        config.load();
        logger.info("Configuración cargada.");
    }

    private boolean testApiConnection() {
        try {
            return apiClient.testConnection();
        } catch (Exception e) {
            logger.error("Error al conectar con la API: {}", e.getMessage());
            return false;
        }
    }

    private void loadMessages() {
        try {
            messageUtil.loadMessages();
            logger.info("Mensajes cargados desde la API.");
        } catch (Exception e) {
            logger.warn("No se pudieron cargar los mensajes desde la API, usando defaults.");
        }
    }

    private void registerListeners() {
        server.getEventManager().register(this, new ConnectionListener(this));
        logger.info("Listeners registrados.");
    }

    private void registerCommands() {
        CommandManager commandManager = server.getCommandManager();
        commandManager.register(
                commandManager.metaBuilder("furrguard")
                        .aliases("fg", "guard")
                        .plugin(this)
                        .build(),
                new FurrGuardCommand(this)
        );
        logger.info("Comandos registrados: /furrguard, /fg, /guard");
    }

    public void reload() {
        loadConfig();
        if (apiClient != null) {
            loadMessages();
        }
        logger.info("Configuración recargada.");
    }

    public static FurrGuard getInstance() {
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

    public LicenseManager getLicenseManager() {
        return licenseManager;
    }

    /**
     * Sends a prefixed message to all online players with furrguard.notify or furrguard.admin permission.
     */
    public void broadcastToAdmins(String message) {
        Component component = messageUtil.prefixed(message);
        int count = 0;
        for (Player player : server.getAllPlayers()) {
            if (player.hasPermission("furrguard.notify") || player.hasPermission("furrguard.admin")) {
                player.sendMessage(component);
                count++;
            }
        }
        // Log without color codes
        String cleanMessage = message.replaceAll("&[0-9a-fk-orx]", "").replaceAll("§[0-9a-fk-orx]", "");
        logger.info("[FG] Notificación admin ({} receptores): {}", count, cleanMessage);
    }

    /**
     * PROTECCIÓN: Bloquea el acceso al servidor si el plugin no está verificado
     */
    @Subscribe(order = PostOrder.FIRST)
    public void onPreLogin(PreLoginEvent event) {
        if (licenseManager != null && !licenseManager.isLicensed()) {
            event.setResult(PreLoginEvent.PreLoginComponentResult.denied(
                Component.text()
                    .append(Component.text("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n").color(TextColor.color(0x555555)))
                    .append(Component.text("     FurrGuard - Sin Licencia\n").color(TextColor.color(0xFF5555)))
                    .append(Component.text("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n").color(TextColor.color(0x555555)))
                    .append(Component.text("\n"))
                    .append(Component.text("  El plugin no está verificado.\n").color(TextColor.color(0xAAAAAA)))
                    .append(Component.text("  Contacta con el administrador.\n").color(TextColor.color(0xAAAAAA)))
                    .append(Component.text("\n"))
                    .append(Component.text("  Discord: ").color(TextColor.color(0x888888)))
                    .append(Component.text("discord.gg/srteb\n").color(TextColor.color(0x55FFFF)))
                    .append(Component.text("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━").color(TextColor.color(0x555555)))
                    .build()
            ));
        }
    }
}
