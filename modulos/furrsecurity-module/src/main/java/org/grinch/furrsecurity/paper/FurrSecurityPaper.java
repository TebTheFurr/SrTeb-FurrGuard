package org.grinch.furrsecurity.paper;

import org.bukkit.plugin.java.JavaPlugin;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.platform.PaperHandler;

/**
 * Paper plugin entry point for FurrSecurity
 */
public class FurrSecurityPaper extends JavaPlugin {

    private FurrSecurity furrSecurity;

    @Override
    public void onEnable() {
        try {
            // Create FurrSecurity instance
            this.furrSecurity = new FurrSecurity(this, getLogger());

            // Initialize the plugin
            this.furrSecurity.onEnable();

            getLogger().info("FurrSecurity Paper plugin enabled successfully!");
        } catch (Exception e) {
            getLogger().severe("Failed to enable FurrSecurity: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void onDisable() {
        if (furrSecurity != null) {
            furrSecurity.onDisable();
        }
    }
}
