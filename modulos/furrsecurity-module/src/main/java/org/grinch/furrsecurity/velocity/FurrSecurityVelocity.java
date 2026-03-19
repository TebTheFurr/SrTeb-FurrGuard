package org.grinch.furrsecurity.velocity;

import com.google.inject.Inject;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.proxy.ProxyServer;
import org.grinch.furrsecurity.FurrSecurity;
import org.slf4j.Logger;

import java.util.logging.Level;

/**
 * Velocity plugin entry point for FurrSecurity
 */
@Plugin(
        id = "furrsecurity",
        name = "FurrSecurity",
        version = "1.0.0",
        description = "Staff Verification System for Minecraft",
        authors = {"GrinchHorizon"}
)
public class FurrSecurityVelocity {

    @Inject
    private Logger slf4jLogger;

    @Inject
    private ProxyServer server;

    private FurrSecurity furrSecurity;

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        try {
            // Create java.util.logging.Logger adapter from slf4j
            java.util.logging.Logger julLogger = new Slf4jLoggerAdapter(slf4jLogger);

            // Create FurrSecurity instance with server reference
            this.furrSecurity = new FurrSecurity(this, julLogger, server);

            // Initialize the plugin
            this.furrSecurity.onEnable();

            slf4jLogger.info("FurrSecurity Velocity plugin initialized successfully!");
        } catch (Exception e) {
            slf4jLogger.error("Failed to initialize FurrSecurity: " + e.getMessage(), e);
        }
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (furrSecurity != null) {
            furrSecurity.onDisable();
        }
    }

    public ProxyServer getServer() {
        return server;
    }

    /**
     * Adapter to convert java.util.logging calls to slf4j
     */
    private static class Slf4jLoggerAdapter extends java.util.logging.Logger {
        private final Logger slf4j;

        Slf4jLoggerAdapter(Logger slf4j) {
            super("FurrSecurity", null);
            this.slf4j = slf4j;
        }

        @Override
        public void info(String msg) {
            slf4j.info(msg);
        }

        @Override
        public void warning(String msg) {
            slf4j.warn(msg);
        }

        @Override
        public void severe(String msg) {
            slf4j.error(msg);
        }

        @Override
        public void log(Level level, String msg) {
            if (level == Level.SEVERE) {
                slf4j.error(msg);
            } else if (level == Level.WARNING) {
                slf4j.warn(msg);
            } else if (level == Level.INFO) {
                slf4j.info(msg);
            } else {
                slf4j.debug(msg);
            }
        }

        @Override
        public void log(Level level, String msg, Throwable thrown) {
            if (level == Level.SEVERE) {
                slf4j.error(msg, thrown);
            } else if (level == Level.WARNING) {
                slf4j.warn(msg, thrown);
            } else if (level == Level.INFO) {
                slf4j.info(msg, thrown);
            } else {
                slf4j.debug(msg, thrown);
            }
        }
    }
}
