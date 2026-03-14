package org.grinch.furrpermsModule.util;

import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrpermsModule.FurrpermsModule;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public class MessageUtil {

    private final FurrpermsModule plugin;
    private final Map<String, String> messages;
    private final LegacyComponentSerializer legacySerializer;

    public MessageUtil(FurrpermsModule plugin) {
        this.plugin = plugin;
        this.messages = new HashMap<>();
        this.legacySerializer = LegacyComponentSerializer.builder()
                .character(LegacyComponentSerializer.AMPERSAND_CHAR)
                .hexColors()
                .build();
    }

    public void loadMessages() {
        Map<String, String> apiMessages = plugin.getApiClient().getMessages();
        messages.clear();
        messages.putAll(apiMessages);
        plugin.getLogger().info("Mensajes cargados: " + messages.size());
    }

    public String getMessage(String key) {
        return messages.getOrDefault(key, getDefaultMessage(key));
    }

    private String getDefaultMessage(String key) {
        return switch (key) {
            case "fur_perms_no_permission" -> "&c✘ &cNo tienes permiso para ejecutar este comando.";
            case "fur_perms_command_blocked" -> "&c✘ &cEl comando está restringido por FurrPerms.";
            case "fur_perms_logged" -> "&c✘ &cTu intento ha sido registrado.";
            case "fur_perms_notify_blocked" -> "&c⚠ &f{player} &7intentó ejecutar &f{command}";
            case "fur_perms_notify_allowed" -> "&a✔ &f{player} &7ejecutó &f{command}";
            default -> key;
        };
    }

    public Component parseMessage(String message) {
        return legacySerializer.deserialize(message
                .replace("§", "&")
                .replace("&x", "#")
        );
    }

    public Component prefixed(String message) {
        return parseMessage("&3[FurrPerms] &r" + message);
    }

    /**
     * Envía notificación SOLO a jugadores en whitelist de FurrPerms
     * También imprime en consola de Velocity
     */
    public void broadcastToAdmins(String message) {
        // Siempre imprimir en consola
        String cleanMessage = message.replaceAll("&[0-9a-fk-orx]", "");
        plugin.getLogger().info("[FurrPerms] " + cleanMessage);

        Component component = prefixed(message);
        int count = 0;

        for (Player player : plugin.getServer().getAllPlayers()) {
            // Verificar si está en whitelist de FurrPerms
            boolean isWhitelisted = plugin.getApiClient().isInWhitelist(
                player.getUsername(),
                player.getUniqueId().toString()
            );

            if (isWhitelisted) {
                player.sendMessage(component);
                count++;
            }
        }

        if (plugin.getConfig().isDebug()) {
            plugin.getLogger().info("[DEBUG] Notificación enviada a " + count + " jugadores whitelist");
        }
    }

    public void sendMessage(Player player, String message) {
        player.sendMessage(parseMessage(message));
    }
}
