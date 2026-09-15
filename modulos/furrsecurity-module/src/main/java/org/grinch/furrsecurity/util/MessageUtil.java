package org.grinch.furrsecurity.util;

import org.grinch.furrsecurity.FurrSecurity;

import java.util.HashMap;
import java.util.Map;

/**
 * Utility class for message formatting
 */
public class MessageUtil {

    private final FurrSecurity plugin;
    private final Map<String, String> messages;

    public MessageUtil(FurrSecurity plugin) {
        this.plugin = plugin;
        this.messages = new HashMap<>();
        loadDefaultMessages();
    }

    private void loadDefaultMessages() {
        messages.put("furr_security_prefix", "&c&lFurrSecurity &8| &7");
        messages.put("furr_security_verification_required", "&cDebes verificar tu identidad para continuar.");
        messages.put("furr_security_verification_link", "&eHaz click para verificar: &b{url}");
        messages.put("furr_security_verification_proxy_mode", "&eVerifica tu identidad en el proxy para continuar.");
        messages.put("furr_security_verification_success", "&aVerificacion completada. Ahora puedes jugar.");
        messages.put("furr_security_verification_failed", "&cVerificacion fallida. Contacta a un administrador.");
        messages.put("furr_security_session_expired", "&cTu sesion ha expirado. Por favor, verifica nuevamente.");
        messages.put("furr_security_session_expiring", "&eTu sesion expira en &c{time}&e. Verifica nuevamente.");
        messages.put("furr_security_not_staff", "&7No necesitas verificacion (no eres staff).");
        messages.put("furr_security_already_verified", "&aYa estas verificado.");
        messages.put("furr_security_locked_movement", "&cEstas bloqueado hasta verificar tu identidad.");
        messages.put("furr_security_locked_command", "&cNo puedes ejecutar comandos hasta verificar.");
        messages.put("furr_security_locked_inventory", "&cNo puedes interactuar con inventarios hasta verificar.");
        messages.put("furr_security_locked_chat", "&cNo puedes enviar mensajes hasta verificar.");
        messages.put("furr_security_locked_server_switch", "&cNo puedes cambiar de servidor hasta verificar.");
        messages.put("furr_security_admin_notification", "&c[FurrSecurity] &7{player} &erequiere verificacion.");
        messages.put("furr_security_reload_success", "&aConfiguracion recargada.");
        messages.put("furr_security_no_permission", "&cNo tienes permiso para esto.");
        messages.put("furr_security_player_not_found", "&cJugador no encontrado.");
        messages.put("furr_security_stats_header", "&8&m------------------&c FurrSecurity &8&m------------------");
        messages.put("furr_security_stats_line", "&7{key}: &f{value}");
        messages.put("furr_security_kick_unverified", "&cNo completaste la verificacion a tiempo.\n&7Por favor, vuelve a entrar e intenta de nuevo.");
        messages.put("furr_security_kick_blacklisted", "&cHas sido añadido a la lista negra por seguridad.\n&7Contacta a un administrador.");
        messages.put("furr_security_verification_timeout", "&eTu enlace de verificacion ha expirado. Saliendo...");
        messages.put("furr_security_auto_blacklisted", "&cHas sido añadido a la blacklist automaticamente por 3 intentos fallidos.");
    }

    public void loadApiMessages() {
        try {
            Map<String, String> apiMessages = plugin.getApiClient().getMessages();
            if (apiMessages != null && !apiMessages.isEmpty()) {
                for (Map.Entry<String, String> entry : apiMessages.entrySet()) {
                    if (entry.getKey().startsWith("furr_security_")) {
                        this.messages.put(entry.getKey(), entry.getValue());
                    }
                }
                plugin.getLogger().info("Mensajes FurrSecurity cargados desde API.");
            }
        } catch (Exception e) {
            plugin.getLogger().warning("No se pudieron cargar mensajes desde API: " + e.getMessage());
        }
    }

    public String get(String key) {
        // Try with furr_security_ prefix first, then bare key for backward compat
        String prefixedKey = "furr_security_" + key;
        if (messages.containsKey(prefixedKey)) {
            return messages.get(prefixedKey);
        }
        return messages.getOrDefault(key, "&cMessage not found: " + key);
    }

    public String get(String key, Map<String, String> placeholders) {
        String message = get(key);
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            message = message.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return message;
    }

    public String prefixed(String key) {
        return get("furr_security_prefix") + get(key);
    }

    public String prefixed(String key, Map<String, String> placeholders) {
        return get("furr_security_prefix") + get(key, placeholders);
    }

    /**
     * Format time in seconds to human readable format
     */
    public String formatTime(long seconds) {
        if (seconds < 60) {
            return seconds + "s";
        } else if (seconds < 3600) {
            long minutes = seconds / 60;
            long secs = seconds % 60;
            return secs > 0 ? minutes + "m " + secs + "s" : minutes + "m";
        } else {
            long hours = seconds / 3600;
            long minutes = (seconds % 3600) / 60;
            return minutes > 0 ? hours + "h " + minutes + "m" : hours + "h";
        }
    }

    /**
     * Parse hex color codes in messages
     */
    public static String translateColors(String message) {
        // First handle hex colors
        message = message.replaceAll("&#([A-Fa-f0-9]{6})", "&x&$1");
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < message.length(); i++) {
            char c = message.charAt(i);
            if (c == '&' && i + 1 < message.length()) {
                char next = message.charAt(i + 1);
                if (next == 'x' && i + 13 < message.length()) {
                    // Hex color format: &x&R&R&G&G&B&B
                    result.append(message.substring(i, i + 14));
                    i += 13;
                    continue;
                }
            }
            result.append(c);
        }
        // Then handle legacy colors
        return org.bukkit.ChatColor.translateAlternateColorCodes('&', result.toString());
    }
}
