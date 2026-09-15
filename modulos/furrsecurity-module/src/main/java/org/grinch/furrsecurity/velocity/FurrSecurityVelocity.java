package org.grinch.furrsecurity.velocity;

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import org.grinch.furrguard.common.log.PluginLogger;
import org.grinch.furrsecurity.BuildConstants;
import org.grinch.furrsecurity.FurrSecurity;
import org.slf4j.Logger;

import java.nio.file.Path;

/** Punto de entrada en Velocity; genera velocity-plugin.json en la compilacion. */
@Plugin(
        id = "furrsecurity",
        name = "FurrSecurity",
        version = BuildConstants.VERSION,
        description = "Verificacion de identidad del staff con Discord",
        url = "https://srteb.eu",
        authors = {"GrinchHorizon"}
)
public final class FurrSecurityVelocity {

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private VelocityHandler handler;
    private FurrSecurity core;

    @Inject
    public FurrSecurityVelocity(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInitialize(ProxyInitializeEvent event) {
        try {
            handler = new VelocityHandler(this, server);
            core = new FurrSecurity(PluginLogger.of(logger::info, logger::warn, (message, error) -> logger.error(message, error)),
                    dataDirectory, handler);
            handler.bind(core);
            core.enable();
        } catch (RuntimeException e) {
            logger.error("FurrSecurity no ha podido arrancar y queda DESACTIVADO: el staff NO esta protegido", e);
            if (handler != null) {
                handler.unbind();
            }
            if (core != null) {
                core.disable();
            }
        }
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (core != null) {
            core.disable();
        }
    }
}
