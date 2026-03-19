package org.grinch.furrsecurity.config;

import org.grinch.furrsecurity.FurrSecurity;
import org.yaml.snakeyaml.Yaml;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Configuration handler for FurrSecurity
 */
public class Config {

    private final FurrSecurity plugin;
    private final Path configPath;
    private Map<String, Object> config;

    // Config values
    private String apiUrl;
    private String apiKey;
    private boolean enabled;
    private boolean proxyMode;  // If true, skip verification (proxy handles it)
    private int sessionDuration;
    private String verifyUrl;
    private List<Long> alertTimes;
    private long earlyVerifyTime;
    private boolean lockMovement;
    private boolean lockCommands;
    private boolean lockInventory;
    private boolean lockServerSwitch;
    private boolean notifyAdmins;
    private String adminPermission;

    public Config(FurrSecurity plugin) {
        this.plugin = plugin;
        this.configPath = plugin.getPlatformHandler() instanceof org.grinch.furrsecurity.platform.PaperHandler
                ? ((org.grinch.furrsecurity.platform.PaperHandler) plugin.getPlatformHandler())
                .getPaperPlugin().getDataFolder().toPath().resolve("config.yml")
                : Path.of("plugins", "furrsecurity", "config.yml");
    }

    public void load() {
        try {
            // Create config directory if needed
            Files.createDirectories(configPath.getParent());

            // Copy default config if not exists
            if (!Files.exists(configPath)) {
                copyDefaultConfig();
            }

            // Load config
            Yaml yaml = new Yaml();
            try (InputStream is = Files.newInputStream(configPath)) {
                config = yaml.load(is);
            }

            if (config == null) {
                config = new HashMap<>();
            }

            // Parse values
            apiUrl = getString("api.url", "https://furrguard.srteb.eu/api/furrsecurity.php");
            apiKey = getString("api.key", "YOUR_API_KEY_HERE");
            enabled = getBoolean("enabled", true);
            proxyMode = getBoolean("proxy-mode", false);
            sessionDuration = getInt("session-duration", 28800);
            verifyUrl = getString("verify-url", "https://furrguard.srteb.eu/verify.php");
            alertTimes = getList("alert-times", List.of(3600L, 1800L, 300L, 240L, 180L, 120L, 60L, 30L));
            earlyVerifyTime = getLong("early-verify-time", 300L);
            lockMovement = getBoolean("lock.movement", true);
            lockCommands = getBoolean("lock.commands", true);
            lockInventory = getBoolean("lock.inventory", true);
            lockServerSwitch = getBoolean("lock.server-switch", true);
            notifyAdmins = getBoolean("notify-admins", true);
            adminPermission = getString("admin-permission", "furrsecurity.notify");

            plugin.getLogger().info("Configuration loaded successfully");

        } catch (Exception e) {
            plugin.getLogger().severe("Failed to load config: " + e.getMessage());
            e.printStackTrace();
            setDefaults();
        }
    }

    private void copyDefaultConfig() {
        try {
            String defaultConfig = generateDefaultConfig();
            Files.writeString(configPath, defaultConfig, StandardCharsets.UTF_8);
            plugin.getLogger().info("Created default config.yml");
        } catch (Exception e) {
            plugin.getLogger().severe("Failed to create default config: " + e.getMessage());
        }
    }

    private String generateDefaultConfig() {
        return """
                # FurrSecurity Configuration
                # Staff Verification System

                # Module enabled
                enabled: true

                # Proxy mode - Set to true on Paper servers behind Velocity
                # When true: Paper will NOT generate verification codes (Velocity handles that)
                # BUT Paper will still lock players and poll for session status
                # This ensures movement/inventory/command restrictions work even in proxy mode
                proxy-mode: false

                # API Configuration
                api:
                  url: "https://furrguard.srteb.eu/api/furrsecurity.php"
                  key: "YOUR_API_KEY_HERE"

                # Session duration in seconds (default: 8 hours)
                session-duration: 28800

                # Verification URL shown to players
                verify-url: "https://furrguard.srteb.eu/verify.php"

                # Alert times in seconds before session expires
                # Default: 1h, 30m, 5m, 4m, 3m, 2m, 1m, 30s
                alert-times:
                  - 3600
                  - 1800
                  - 300
                  - 240
                  - 180
                  - 120
                  - 60
                  - 30

                # Time in seconds before expiry when player can re-verify early
                early-verify-time: 300

                # Player lock settings (what to block while unverified)
                lock:
                  movement: true
                  commands: true
                  inventory: true
                  server-switch: true

                # Admin notification settings
                notify-admins: true
                admin-permission: "furrsecurity.notify"
                """;
    }

    private void setDefaults() {
        apiUrl = "https://furrguard.srteb.eu/api/furrsecurity.php";
        apiKey = "YOUR_API_KEY_HERE";
        enabled = true;
        proxyMode = false;
        sessionDuration = 28800;
        verifyUrl = "https://furrguard.srteb.eu/verify.php";
        alertTimes = List.of(3600L, 1800L, 300L, 240L, 180L, 120L, 60L, 30L);
        earlyVerifyTime = 300L;
        lockMovement = true;
        lockCommands = true;
        lockInventory = true;
        lockServerSwitch = true;
        notifyAdmins = true;
        adminPermission = "furrsecurity.notify";
    }

    @SuppressWarnings("unchecked")
    private String getString(String key, String def) {
        Object value = getNestedValue(key);
        return value != null ? value.toString() : def;
    }

    private boolean getBoolean(String key, boolean def) {
        Object value = getNestedValue(key);
        return value instanceof Boolean ? (Boolean) value : def;
    }

    private int getInt(String key, int def) {
        Object value = getNestedValue(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return def;
    }

    private long getLong(String key, long def) {
        Object value = getNestedValue(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return def;
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> getList(String key, List<T> def) {
        Object value = getNestedValue(key);
        if (value instanceof List) {
            return (List<T>) value;
        }
        return def;
    }

    @SuppressWarnings("unchecked")
    private Object getNestedValue(String key) {
        String[] parts = key.split("\\.");
        Object current = config;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
                if (current == null) return null;
            } else {
                return null;
            }
        }
        return current;
    }

    // Getters

    public String getApiUrl() {
        return apiUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isProxyMode() {
        return proxyMode;
    }

    public int getSessionDuration() {
        return sessionDuration;
    }

    public String getVerifyUrl() {
        return verifyUrl;
    }

    public List<Long> getAlertTimes() {
        return alertTimes;
    }

    public long getEarlyVerifyTime() {
        return earlyVerifyTime;
    }

    public boolean isLockMovement() {
        return lockMovement;
    }

    public boolean isLockCommands() {
        return lockCommands;
    }

    public boolean isLockInventory() {
        return lockInventory;
    }

    public boolean isLockServerSwitch() {
        return lockServerSwitch;
    }

    public boolean isNotifyAdmins() {
        return notifyAdmins;
    }

    public String getAdminPermission() {
        return adminPermission;
    }
}
