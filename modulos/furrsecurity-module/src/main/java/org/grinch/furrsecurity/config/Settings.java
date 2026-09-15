package org.grinch.furrsecurity.config;

import org.grinch.furrguard.common.config.YamlConfig;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Ajustes que usa el cliente. {@code config.yml} da los valores iniciales; en cuanto responde
 * {@code get_settings} mandan los del panel (docs/API.md §7). {@code lock.chat} no existe en el panel.
 *
 * @param alertTimes segundos antes de caducar la sesion en que se avisa, de mayor a menor
 */
public record Settings(boolean lockMovement, boolean lockCommands, boolean lockInventory, boolean lockServerSwitch,
                       boolean lockChat, boolean notifyAdmins, String adminPermission, long earlyVerifySeconds,
                       List<Long> alertTimes) {

    public static final List<Long> DEFAULT_ALERT_TIMES = List.of(3600L, 1800L, 300L, 240L, 180L, 120L, 60L, 30L);
    public static final String DEFAULT_ADMIN_PERMISSION = "furrsecurity.notify";
    private static final Pattern PERMISSION = Pattern.compile("[a-z0-9._*-]+");

    public Settings {
        alertTimes = sorted(alertTimes);
    }

    public static Settings fromYaml(YamlConfig config) {
        return new Settings(
                config.bool("lock.movement", true),
                config.bool("lock.commands", true),
                config.bool("lock.inventory", true),
                config.bool("lock.server-switch", true),
                config.bool("lock.chat", true),
                config.bool("notify-admins", true),
                permission(config.string("admin-permission", null), DEFAULT_ADMIN_PERMISSION),
                Math.max(0, config.longValue("early-verify-time", 300)),
                config.longList("alert-times", DEFAULT_ALERT_TIMES));
    }

    /** Aplica {@code get_settings}; una clave ausente o con un valor invalido conserva el valor actual. */
    public Settings withApi(Map<String, String> api) {
        return new Settings(
                bool(api.get("furrsecurity_lock_movement"), lockMovement),
                bool(api.get("furrsecurity_lock_commands"), lockCommands),
                bool(api.get("furrsecurity_lock_inventory"), lockInventory),
                bool(api.get("furrsecurity_lock_server_switch"), lockServerSwitch),
                lockChat,
                bool(api.get("furrsecurity_notify_admins"), notifyAdmins),
                permission(api.get("furrsecurity_admin_permission"), adminPermission),
                seconds(api.get("furrsecurity_early_verify_time"), earlyVerifySeconds),
                csvSeconds(api.get("furrsecurity_alert_times"), alertTimes));
    }

    /** Lista CSV de enteros >= 0; los elementos invalidos se ignoran. {@code null} → {@code def}. */
    static List<Long> csvSeconds(String csv, List<Long> def) {
        if (csv == null) {
            return def;
        }
        List<Long> values = new ArrayList<>();
        for (String part : csv.split(",")) {
            long value = seconds(part, -1);
            if (value >= 0) {
                values.add(value);
            }
        }
        return values;
    }

    private static List<Long> sorted(List<Long> times) {
        return times.stream().filter(time -> time != null && time > 0).distinct()
                .sorted(Comparator.reverseOrder()).toList();
    }

    private static boolean bool(String raw, boolean def) {
        if (raw == null) {
            return def;
        }
        return switch (raw.strip().toLowerCase(Locale.ROOT)) {
            case "1", "true" -> true;
            case "0", "false" -> false;
            default -> def;
        };
    }

    private static long seconds(String raw, long def) {
        try {
            return raw == null ? def : Math.max(0, Long.parseLong(raw.strip()));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static String permission(String raw, String def) {
        return raw != null && PERMISSION.matcher(raw.strip()).matches() ? raw.strip() : def;
    }
}
