package org.grinch.furrGuard.config;

import org.grinch.furrGuard.FurrGuard;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

public class Config {

    private final FurrGuard plugin;
    private final Path configFile;
    private Map<String, Object> config;

    public Config(FurrGuard plugin) {
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

        Map<String, Object> api = new LinkedHashMap<>();
        api.put("url", "https://tu-dominio.com/api/plugin.php");
        api.put("key", "YOUR_SECURE_API_KEY_HERE");
        api.put("timeout", 5000);
        config.putIfAbsent("api", api);

        Map<String, Object> cache = new LinkedHashMap<>();
        cache.put("enabled", true);
        cache.put("duration", 300);
        config.putIfAbsent("cache", cache);

        Map<String, Object> bypass = new LinkedHashMap<>();
        bypass.put("permission", "furrguard.bypass");
        config.putIfAbsent("bypass", bypass);
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
                writer.write("# FurrGuard Configuration\n");
                writer.write("# (c) SrTeb Limited - https://srteb.eu\n");
                writer.write("# ═══════════════════════════════════════\n\n");
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

    public String getApiUrl() {
        return getString("api.url", "");
    }

    public String getApiKey() {
        return getString("api.key", "");
    }

    public int getApiTimeout() {
        return getInt("api.timeout", 5000);
    }

    public boolean isCacheEnabled() {
        return getBoolean("cache.enabled", true);
    }

    public int getCacheDuration() {
        return getInt("cache.duration", 300);
    }

    public String getBypassPermission() {
        return getString("bypass.permission", "furrguard.bypass");
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