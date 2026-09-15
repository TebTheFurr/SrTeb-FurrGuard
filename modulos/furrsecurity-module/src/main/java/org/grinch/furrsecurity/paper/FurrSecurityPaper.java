package org.grinch.furrsecurity.paper;

import org.bukkit.plugin.java.JavaPlugin;
import org.grinch.furrguard.common.log.PluginLogger;
import org.grinch.furrsecurity.FurrSecurity;

import java.util.logging.Level;
import java.util.logging.Logger;

/** Punto de entrada en Paper. */
public final class FurrSecurityPaper extends JavaPlugin {

    private FurrSecurity core;

    @Override
    public void onEnable() {
        Logger log = getLogger();
        try {
            PaperHandler handler = new PaperHandler(this);
            core = new FurrSecurity(PluginLogger.of(log::info, log::warning, (message, error) -> log.log(Level.SEVERE, message, error)),
                    getDataFolder().toPath(), handler);
            handler.bind(core);
            core.enable();
        } catch (RuntimeException e) {
            log.log(Level.SEVERE, "FurrSecurity no ha podido arrancar y se desactiva: el staff NO esta protegido", e);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    /** Hilo principal: la ceguera de los bloqueados se quita aqui mismo. */
    @Override
    public void onDisable() {
        if (core != null) {
            core.disable();
        }
    }
}
