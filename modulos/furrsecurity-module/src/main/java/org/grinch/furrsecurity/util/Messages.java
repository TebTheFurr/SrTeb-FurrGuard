package org.grinch.furrsecurity.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import org.grinch.furrguard.common.text.SafeText;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

import static java.util.Map.entry;

/**
 * Mensajes {@code furr_security_*} (docs/API.md §2): los del panel sustituyen a estos por defecto.
 * Los valores de los placeholders nunca se interpretan como formato ({@link SafeText}).
 */
public final class Messages {

    public static final String KEY_PREFIX = "furr_security_";
    private static final Pattern WEB_URL = Pattern.compile("https?://\\S+");

    private static final Map<String, String> DEFAULTS = Map.ofEntries(
            entry("prefix", "&c&lFurrSecurity &8| &7"),
            entry("verification_required", "&cDebes verificar tu identidad para continuar."),
            entry("verification_link", "&eHaz click para verificar: &b{url}"),
            entry("verification_proxy_mode", "&eVerifica tu identidad en el proxy para continuar."),
            entry("verification_success", "&aVerificacion completada. Ahora puedes jugar."),
            entry("verification_failed", "&cVerificacion fallida. Contacta a un administrador."),
            entry("session_expired", "&cTu sesion ha expirado. Por favor, verifica nuevamente."),
            entry("session_expiring", "&eTu sesion expira en &c{time}&e. Verifica nuevamente."),
            entry("not_staff", "&7No necesitas verificacion (no eres staff)."),
            entry("already_verified", "&aYa estas verificado."),
            entry("locked_movement", "&cEstas bloqueado hasta verificar tu identidad."),
            entry("locked_command", "&cNo puedes ejecutar comandos hasta verificar."),
            entry("locked_inventory", "&cNo puedes interactuar con inventarios hasta verificar."),
            entry("locked_chat", "&cNo puedes enviar mensajes hasta verificar."),
            entry("locked_server_switch", "&cNo puedes cambiar de servidor hasta verificar."),
            entry("admin_notification", "&c[FurrSecurity] &7{player} &erequiere verificacion."),
            entry("reload_success", "&aConfiguracion recargada."),
            entry("no_permission", "&cNo tienes permiso para esto."),
            entry("player_not_found", "&cJugador no encontrado."),
            entry("stats_header", "&8&m------------------&c FurrSecurity &8&m------------------"),
            entry("stats_line", "&7{key}: &f{value}"),
            entry("kick_unverified", "&cNo completaste la verificacion a tiempo.\n&7Por favor, vuelve a entrar e intenta de nuevo."),
            entry("kick_blacklisted", "&cHas sido añadido a la lista negra por seguridad.\n&7Contacta a un administrador."),
            entry("verification_timeout", "&eTu enlace de verificacion ha expirado. Saliendo..."),
            entry("auto_blacklisted", "&cHas sido añadido a la blacklist automaticamente por 3 intentos fallidos."));

    private final Map<String, String> templates;

    private Messages(Map<String, String> templates) {
        this.templates = Map.copyOf(templates);
    }

    public static Messages defaults() {
        return new Messages(DEFAULTS);
    }

    /** {@code get_messages}: objeto plano; solo cuentan las claves {@code furr_security_*}. */
    public Messages withOverrides(Map<String, String> api) {
        Map<String, String> merged = new HashMap<>(templates);
        api.forEach((key, value) -> {
            if (key.startsWith(KEY_PREFIX) && key.length() > KEY_PREFIX.length() && value != null) {
                merged.put(key.substring(KEY_PREFIX.length()), value);
            }
        });
        return new Messages(merged);
    }

    /**
     * @param key          sin el prefijo {@code furr_security_}
     * @param placeholders pares clave, valor: {@code "url", url, "verify_url", url}
     */
    public Component get(String key, String... placeholders) {
        return SafeText.render(template(key), pairs(placeholders));
    }

    /** Prefijo + mensaje; vacio si el mensaje esta vacio (el panel lo ha silenciado). */
    public Component prefixed(String key, String... placeholders) {
        String message = template(key);
        return message.isBlank() ? Component.empty() : SafeText.render(template("prefix") + message, pairs(placeholders));
    }

    /** Solo se hace clicable una URL http(s). */
    public static Component clickable(Component message, String url) {
        return url != null && WEB_URL.matcher(url).matches() ? message.clickEvent(ClickEvent.openUrl(url)) : message;
    }

    public static String formatTime(long seconds) {
        long safe = Math.max(0, seconds);
        if (safe < 60) {
            return safe + "s";
        }
        if (safe < 3600) {
            return safe % 60 == 0 ? safe / 60 + "m" : safe / 60 + "m " + safe % 60 + "s";
        }
        long minutes = safe % 3600 / 60;
        return minutes == 0 ? safe / 3600 + "h" : safe / 3600 + "h " + minutes + "m";
    }

    /** El panel guarda los saltos de linea como el texto literal {@code \n}. */
    private String template(String key) {
        return templates.getOrDefault(key, "").replace("\\n", "\n");
    }

    private static Map<String, String> pairs(String... placeholders) {
        Map<String, String> values = new HashMap<>();
        for (int i = 0; i + 1 < placeholders.length; i += 2) {
            values.put(placeholders[i], placeholders[i + 1]);
        }
        return values;
    }
}
