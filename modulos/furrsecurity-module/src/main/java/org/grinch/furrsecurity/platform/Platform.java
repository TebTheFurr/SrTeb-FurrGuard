package org.grinch.furrsecurity.platform;

import org.grinch.furrsecurity.FurrSecurity;

/**
 * Enum representing supported platforms
 */
public enum Platform {
    VELOCITY {
        @Override
        public PlatformHandler createHandler(FurrSecurity plugin, Object platformPlugin, Object server) {
            return new VelocityHandler(plugin, platformPlugin, (com.velocitypowered.api.proxy.ProxyServer) server);
        }
    },
    PAPER {
        @Override
        public PlatformHandler createHandler(FurrSecurity plugin, Object platformPlugin, Object server) {
            return new PaperHandler(plugin, platformPlugin);
        }
    };

    public abstract PlatformHandler createHandler(FurrSecurity plugin, Object platformPlugin, Object server);
}
