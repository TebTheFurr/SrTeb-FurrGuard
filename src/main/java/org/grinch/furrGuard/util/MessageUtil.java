package org.grinch.furrGuard.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrGuard.FurrGuard;

import java.util.HashMap;
import java.util.Map;

public class MessageUtil {

    private final FurrGuard plugin;
    private Map<String, String> messages;
    private Map<String, String> settings;
    private final LegacyComponentSerializer serializer;

    public MessageUtil(FurrGuard plugin) {
        this.plugin = plugin;
        this.messages = new HashMap<>();
        this.settings = new HashMap<>();
        this.serializer = LegacyComponentSerializer.legacyAmpersand();
        setDefaultMessages();
    }

    private void setDefaultMessages() {
        // Prefix
        messages.put("prefix", "&8[&x&0&0&F&F&A&A&lFurrGuard&8] &7");

        // Kick messages - Professional styled screens
        messages.put("kick_proxy",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Se ha detectado el uso de       ║\n" +
            "&8║   &c&lPROXY&7 en tu conexión.         ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Si crees que es un error,       ║\n" +
            "&8║   &fabre un ticket en nuestro       ║\n" +
            "&8║   &b&lDiscord&7.                      ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_vpn",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Se ha detectado el uso de       ║\n" +
            "&8║   &c&lVPN&7 en tu conexión.           ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Las VPNs no están permitidas    ║\n" +
            "&8║   &7en este servidor.               ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_hosting",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Tu conexión proviene de un      ║\n" +
            "&8║   &c&lDatacenter/Hosting&7.           ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Solo conexiones residenciales   ║\n" +
            "&8║   &7están permitidas.               ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_blacklisted",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CUENTA SUSPENDIDA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Tu cuenta ha sido suspendida{time_remaining}&7.\n" +
            "&8║                                    ║\n" +
            "&8║   &e&lRazón:&f {reason}&8\n" +
            "&8║                                    ║\n" +
            "&8║   &7Si crees que es un error,       ║\n" +
            "&8║   &fcontacta con la administración. ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_blocked_provider",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Tu proveedor de internet       ║\n" +
            "&8║   &7está &c&lbloqueado&7.              ║\n" +
            "&8║                                    ║\n" +
            "&8║   &eISP:&f {isp}&8\n" +
            "&8║                                    ║\n" +
            "&8║   &7Contacta con administración    ║\n" +
            "&8║   &7para más información.          ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_country_blocked",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Tu país está &c&lbloqueado&7.      ║\n" +
            "&8║                                    ║\n" +
            "&8║   &ePaís:&f {country}&8\n" +
            "&8║                                    ║\n" +
            "&8║   &7Disculpa las molestias.        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_default",
            "&8╔════════════════════════════════════╗\n" +
            "&8║  &6&l{server_name}&8                    ║\n" +
            "&8║                                    ║\n" +
            "&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7No se permite tu conexión      ║\n" +
            "&8║   &7a este servidor.               ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Si crees que es un error,       ║\n" +
            "&8║   &fcontacta con la administración. ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8Discord: &b{discord}&8\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        // Error kick messages
        messages.put("kick_api_error",
            "&8╔════════════════════════════════════╗\n" +
            "&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7No se pudo verificar tu        ║\n" +
            "&8║   &7conexión en este momento.       ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Por favor, inténtalo de nuevo.  ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        messages.put("kick_timeout",
            "&8╔════════════════════════════════════╗\n" +
            "&8║     &c&l✘ TIEMPO DE ESPERA AGOTADO ✘&8 ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7La verificación tardó demasiado║\n" +
            "&8║   &7en completarse.                 ║\n" +
            "&8║                                    ║\n" +
            "&8║   &7Por favor, inténtalo de nuevo.  ║\n" +
            "&8║                                    ║\n" +
            "&8║   &8ID: &7{id}&8                       ║\n" +
            "&8╚════════════════════════════════════╝");

        // Admin notifications - styled with colors
        messages.put("whitelist_added", "&x&0&0&F&F&A&A&l+ &7Whitelist añadida: &f{type} &8= &f{value}");
        messages.put("whitelist_removed", "&c&l- &7Whitelist eliminada: &f{type} &8= &f{value}");
        messages.put("blacklist_added", "&c&l+ &7Blacklist añadida: &f{type} &8= &f{value}");
        messages.put("blacklist_removed", "&x&0&0&F&F&A&A&l- &7Blacklist eliminada: &f{type} &8= &f{value}");

        // Command messages
        messages.put("no_permission", "&c&l✘ &7No tienes permiso para usar este comando.");
        messages.put("reload_success", "&x&0&0&F&F&A&A&l✔ &7Configuración recargada correctamente.");
        messages.put("player_not_found", "&c&l✘ &7Jugador no encontrado.");
        messages.put("invalid_type", "&c&l✘ &7Tipo inválido. Usa: &fuuid, nick, ip, asn, cidr");

        // Admin notifications - Blocking alerts
        messages.put("notify_proxy_blocked", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cProxy detectado");
        messages.put("notify_vpn_blocked", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cVPN detectada");
        messages.put("notify_hosting_blocked", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cHosting detectado");
        messages.put("notify_provider_blocked", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cProveedor: &f{isp}");
        messages.put("notify_country_blocked", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cPaís: &f{country}");
        messages.put("notify_blacklisted", "&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cBlacklist &8[#{ban_id}]");

        // Admin notifications - Allow alerts
        messages.put("notify_whitelisted", "&x&0&0&F&F&A&A&l✓ &a{player} &7permitido &8• &f{ip} &8• &aWhitelist");

        // Connection notifications
        messages.put("notify_player_join", "&e➜ &e{player} &7conectó desde &f{country} &8({country_code})");
        messages.put("notify_non_hispanic_join", "&6⚠ &f{player} &7conectó desde &f{country} &8({country_code}) &6(No hispanohablante)");
        messages.put("notify_player_disconnect", "&7➜ &7{player} &8desconectó");

        // System notifications
        messages.put("notify_settings_updated", "&e⚙ &7Configuración actualizada desde el &fpanel web");
        messages.put("notify_providers_updated", "&e⚠ &7Proveedores bloqueados actualizados &8({details})");
        messages.put("notify_player_kicked", "&c&l⚔ &c{player} &7expulsado &8• &f{ip} &8• &c{reason}");
    }

    public void loadMessages() {
        try {
            Map<String, String> apiMessages = plugin.getApiClient().getMessages();
            if (!apiMessages.isEmpty()) {
                for (Map.Entry<String, String> entry : apiMessages.entrySet()) {
                    this.messages.put(entry.getKey(), entry.getValue());
                }
                plugin.getLogger().info("Cargados " + apiMessages.size() + " mensajes desde la API.");
            }
        } catch (Exception e) {
            plugin.getLogger().error("No se pudieron cargar mensajes desde API: " + e.getMessage());
            plugin.getLogger().error("Usando mensajes por defecto. Verifica la conexión y la tabla 'messages'.");
            plugin.broadcastToAdmins("&c⚠ &7No se pudieron cargar mensajes personalizados.");
        }
        try {
            Map<String, String> apiSettings = plugin.getApiClient().getSettings();
            if (!apiSettings.isEmpty()) {
                this.settings.putAll(apiSettings);
            }
        } catch (Exception e) {
            plugin.getLogger().error("No se pudieron cargar settings desde API: " + e.getMessage());
            plugin.broadcastToAdmins("&c⚠ &7No se pudo cargar configuración desde API.");
        }
    }

    public String getSetting(String key, String defaultValue) {
        return settings.getOrDefault(key, defaultValue);
    }

    public String applyGlobalPlaceholders(String message) {
        return message
                .replace("{server_name}", getSetting("server_name", "MI SERVIDOR"))
                .replace("{discord}", getSetting("discord_url", "discord.gg/tuservidor"));
    }

    public String getMessage(String key, String defaultValue) {
        return messages.getOrDefault(key, defaultValue);
    }

    public String getMessage(String key) {
        return messages.getOrDefault(key, key);
    }

    public String getPrefix() {
        return getMessage("prefix", "&8[&x&0&0&F&F&A&A&lFurrGuard&8] &7");
    }

    public Component parseMessage(String message) {
        return serializer.deserialize(message);
    }

    public Component prefixed(String message) {
        return parseMessage(getPrefix() + message);
    }

    public String replacePlaceholders(String message, Map<String, String> placeholders) {
        String result = message;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return result;
    }

    public String formatTimeRemaining(String expiresAt) {
        if (expiresAt == null || expiresAt.isEmpty()) {
            return " &cpermanentemente";
        }
        try {
            java.time.LocalDateTime expiry = java.time.LocalDateTime.parse(
                expiresAt, java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            java.time.Duration duration = java.time.Duration.between(now, expiry);

            if (duration.isNegative() || duration.isZero()) {
                return " &cpermanentemente";
            }

            long days = duration.toDays();
            long hours = duration.toHours() % 24;
            long minutes = duration.toMinutes() % 60;

            StringBuilder sb = new StringBuilder(" &e temporalmente");
            sb.append("\n&8║   &7Tiempo restante: &f");
            if (days > 0) sb.append(days).append("d ");
            if (hours > 0) sb.append(hours).append("h ");
            sb.append(minutes).append("m");
            return sb.toString();
        } catch (Exception e) {
            return " &cpermanentemente";
        }
    }
}
