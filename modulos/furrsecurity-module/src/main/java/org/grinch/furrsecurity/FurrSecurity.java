package org.grinch.furrsecurity;

import org.grinch.furrsecurity.api.ApiClient;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.config.Config;
import org.grinch.furrsecurity.manager.PlayerLockManager;
import org.grinch.furrsecurity.manager.SessionManager;
import org.grinch.furrsecurity.manager.VerificationManager;
import org.grinch.furrsecurity.platform.Platform;
import org.grinch.furrsecurity.platform.PlatformHandler;
import org.grinch.furrsecurity.util.MessageUtil;

import java.util.logging.Logger;

/**
 * FurrSecurity - Staff Verification System
 * Multi-platform plugin supporting Velocity and Paper
 *
 * @author GrinchHorizon
 * @version 1.0.0
 */
public class FurrSecurity {

    private static FurrSecurity instance;
    private final Logger logger;
    private final Object plugin;
    private final Object server;
    private Platform platform;
    private PlatformHandler platformHandler;

    private Config config;
    private ApiClient apiClient;
    private PlayerLockManager playerLockManager;
    private VerificationManager verificationManager;
    private SessionManager sessionManager;
    private MessageUtil messageUtil;

    /**
     * Constructor for Velocity (with server reference)
     */
    public FurrSecurity(Object plugin, Logger logger, Object server) {
        instance = this;
        this.plugin = plugin;
        this.logger = logger;
        this.server = server;

        // Detect platform
        this.platform = detectPlatform();
        this.logger.info("Detected platform: " + this.platform.name());

        // Create platform-specific handler
        this.platformHandler = this.platform.createHandler(this, plugin, server);
    }

    /**
     * Constructor for Paper (without server reference, not needed)
     */
    public FurrSecurity(Object plugin, Logger logger) {
        this(plugin, logger, null);
    }

    /**
     * Detect the current platform by checking class availability
     */
    private Platform detectPlatform() {
        try {
            Class.forName("com.velocitypowered.api.proxy.ProxyServer");
            return Platform.VELOCITY;
        } catch (ClassNotFoundException e) {
            return Platform.PAPER;
        }
    }

    /**
     * Initialize the plugin
     */
    public void onEnable() {
        try {
            // Load configuration
            this.config = new Config(this);
            this.config.load();

            // Initialize utilities
            this.messageUtil = new MessageUtil(this);

            // Initialize API client
            this.apiClient = new ApiClient(this);

            // Load messages from API (overrides defaults)
            this.messageUtil.loadApiMessages();

            // Initialize managers
            this.playerLockManager = new PlayerLockManager(this);
            this.verificationManager = new VerificationManager(this);
            this.sessionManager = new SessionManager(this);

            // Initialize platform-specific components
            this.platformHandler.initialize();

            // Register commands
            registerCommands();

            this.logger.info("FurrSecurity v" + getVersion() + " enabled successfully!");
        } catch (Exception e) {
            this.logger.severe("Failed to enable FurrSecurity: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Shutdown the plugin
     */
    public void onDisable() {
        try {
            if (this.sessionManager != null) {
                this.sessionManager.shutdown();
            }
            if (this.platformHandler != null) {
                this.platformHandler.shutdown();
            }
            this.logger.info("FurrSecurity disabled.");
        } catch (Exception e) {
            this.logger.severe("Error during shutdown: " + e.getMessage());
        }
    }

    /**
     * Register plugin commands
     */
    private void registerCommands() {
        FurrSecurityCommand command = new FurrSecurityCommand(this);
        this.platformHandler.registerCommand(command);
    }

    // Getters

    public static FurrSecurity getInstance() {
        return instance;
    }

    public Logger getLogger() {
        return logger;
    }

    public Platform getPlatform() {
        return platform;
    }

    public PlatformHandler getPlatformHandler() {
        return platformHandler;
    }

    public Config getConfig() {
        return config;
    }

    public ApiClient getApiClient() {
        return apiClient;
    }

    public PlayerLockManager getPlayerLockManager() {
        return playerLockManager;
    }

    public VerificationManager getVerificationManager() {
        return verificationManager;
    }

    public SessionManager getSessionManager() {
        return sessionManager;
    }

    public MessageUtil getMessageUtil() {
        return messageUtil;
    }

    public Object getPluginObject() {
        return plugin;
    }

    public String getVersion() {
        return "1.0.0";
    }
}
