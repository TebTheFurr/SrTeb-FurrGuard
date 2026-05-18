package org.grinch.furrpermsModule.config;

import org.grinch.furrpermsModule.FurrpermsModule;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

public class Config {

    private final FurrpermsModule plugin;
    private final Path configFile;
    private Map<String, Object> config;

    public Config(FurrpermsModule plugin) {
        this.plugin = plugin;
        this.configFile = plugin.getDataDirectory().resolve("config.yml");
    }

    public void load() {
        try {
            if (!Files.exists(plugin.getDataDirectory())) {
                Files.createDirectories(plugin.getDataDirectory());
            }

            if (!Files.exists(configFile)) {
                createDefaultConfig();
            }

            Yaml yaml = new Yaml();
            try (InputStream inputStream = Files.newInputStream(configFile)) {
                config = yaml.load(inputStream);
                if (config == null) {
                    config = new LinkedHashMap<>();
                }
            }
        } catch (IOException e) {
            plugin.getLogger().error("Error al cargar la configuración: " + e.getMessage());
            config = new LinkedHashMap<>();
            setDefaults();
        }
    }

    private void createDefaultConfig() throws IOException {
        config = new LinkedHashMap<>();
        setDefaults();
        save();
    }

    private void setDefaults() {
        config.putIfAbsent("enabled", true);
        config.putIfAbsent("debug", false);
        config.putIfAbsent("api-key", "YOUR_FURRGUARD_API_KEY_HERE");

        Map<String, Object> commands = new LinkedHashMap<>();
        commands.put("protected", "op,lp,lpv,perms,luckperms,lp user,lp group,lp permission,lp verbose,perm,permissions,minecraft:op,minecraft:deop");
        config.putIfAbsent("commands", commands);

        Map<String, Object> notifications = new LinkedHashMap<>();
        notifications.put("blocked", true);
        notifications.put("allowed", true);
        config.putIfAbsent("notifications", notifications);
    }

    public void save() {
        try {
            DumperOptions options = new DumperOptions();
            options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
            options.setPrettyFlow(true);
            options.setIndent(2);

            Yaml yaml = new Yaml(options);
            try (Writer writer = Files.newBufferedWriter(configFile)) {
                writer.write("# ═══════════════════════════════════════\n");
                writer.write("# FurrPerms Module Configuration\n");
                writer.write("# (c) SrTeb Limited - https://srteb.eu\n");
                writer.write("# ═══════════════════════════════════════\n");
                writer.write("# API URL: https://furrguard.srteb.eu (hardcoded)\n\n");
                yaml.dump(config, writer);
            }
        } catch (IOException e) {
            plugin.getLogger().error("Error al guardar la configuración: " + e.getMessage());
        }
    }

    public boolean isEnabled() {
        return getBoolean("enabled", true);
    }

    public boolean isDebug() {
        return getBoolean("debug", false);
    }

    public String getProtectedCommands() {
        return getString("commands.protected", "op,lp,lpv");
    }

    public boolean notifyBlocked() {
        return getBoolean("notifications.blocked", true);
    }

    public boolean notifyAllowed() {
        return getBoolean("notifications.allowed", true);
    }

    public String getApiKey() {
        return getString("api-key", "");
    }

    @SuppressWarnings("unchecked")
    private String getString(String path, String def) {
        String[] parts = path.split("\\.");
        Object current = config;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return def;
            }
        }

        return current != null ? current.toString() : def;
    }

    @SuppressWarnings("unchecked")
    private boolean getBoolean(String path, boolean def) {
        String[] parts = path.split("\\.");
        Object current = config;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return def;
            }
        }

        if (current instanceof Boolean) {
            return (Boolean) current;
        }
        return def;
    }

    @SuppressWarnings("unchecked")
    private int getInt(String path, int def) {
        String[] parts = path.split("\\.");
        Object current = config;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return def;
            }
        }

        if (current instanceof Number) {
            return ((Number) current).intValue();
        }
        return def;
    }
}
