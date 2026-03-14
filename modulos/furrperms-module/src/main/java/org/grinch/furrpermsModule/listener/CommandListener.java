package org.grinch.furrpermsModule.listener;

import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.event.command.CommandExecuteEvent.CommandResult;
import com.velocitypowered.api.event.player.PlayerChatEvent;
import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrpermsModule.FurrpermsModule;

import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

public class CommandListener {

    private final FurrpermsModule plugin;
    private final Set<String> PROTECTED_BASE_COMMANDS = Set.of(
            "op", "deop", "minecraft:op", "minecraft:deop",
            "lp", "luckperms", "lpv", "luckpermsv",
            "perms", "permissions", "perm"
    );

    public CommandListener(FurrpermsModule plugin) {
        this.plugin = plugin;
    }

    @Subscribe(order = PostOrder.EARLY)
    public void onPlayerChat(PlayerChatEvent event) {
        if (!plugin.getConfig().isEnabled()) {
            return;
        }

        // Solo procesar comandos (empiezan con /)
        String message = event.getMessage().trim();
        if (!message.startsWith("/")) {
            return;
        }

        Player player = event.getPlayer();

        // Debug: log todos los comandos de chat
        if (plugin.getConfig().isDebug()) {
            plugin.getLogger().info("[DEBUG] Chat comando: " + message + " por " + player.getUsername());
        }

        String rawCommand = message.substring(1).trim(); // Quitar el /
        String command = rawCommand.toLowerCase();
        String[] parts = command.split(" ");
        String baseCommand = parts[0];

        // Verificar si es un comando protegido
        if (!isProtectedCommand(baseCommand, parts)) {
            return;
        }

        plugin.getLogger().info("[FurrPerms] Comando protegido detectado (chat): " + rawCommand + " por " + player.getUsername());

        // NO verificar bypass permission - la whitelist del módulo es la única fuente de verdad

        // Verificar con la API
        String server = player.getCurrentServer()
                .map(serverConn -> serverConn.getServerInfo().getName())
                .orElse("unknown");

        boolean allowed = plugin.getApiClient().checkCommand(
                player.getUsername(),
                player.getUniqueId().toString(),
                baseCommand,
                server
        );

        plugin.getLogger().info("[FurrPerms] API respondió: " + (allowed ? "PERMITIDO" : "BLOQUEADO"));

        if (!allowed) {
            // Bloquear comando
            event.setResult(PlayerChatEvent.ChatResult.denied());

            // Loggear y notificar en background
            plugin.getServer().getScheduler().buildTask(plugin, () -> {
                plugin.getApiClient().logCommand(
                        player.getUsername(),
                        player.getUniqueId().toString(),
                        rawCommand,
                        server,
                        false,
                        "No autorizado"
                );

                // Notificar al jugador
                String blockMsg = plugin.getMessageUtil().getMessage("fur_perms_command_blocked")
                        .replace("{command}", rawCommand);
                plugin.getMessageUtil().sendMessage(player, blockMsg);

                // Notificar admins
                if (plugin.getConfig().notifyBlocked()) {
                    String notifyMsg = plugin.getMessageUtil().getMessage("fur_perms_notify_blocked")
                            .replace("{player}", player.getUsername())
                            .replace("{command}", rawCommand)
                            .replace("{server}", server);
                    plugin.getMessageUtil().broadcastToAdmins(notifyMsg);
                }
            }).schedule();

            plugin.getLogger().info("[FurrPerms] Comando BLOQUEADO: " + player.getUsername() + " intentó ejecutar: " + rawCommand);
        } else {
            // Comando permitido - loggear en background
            plugin.getServer().getScheduler().buildTask(plugin, () -> {
                if (plugin.getConfig().notifyAllowed()) {
                    String notifyMsg = plugin.getMessageUtil().getMessage("fur_perms_notify_allowed")
                            .replace("{player}", player.getUsername())
                            .replace("{command}", rawCommand)
                            .replace("{server}", server);
                    plugin.getMessageUtil().broadcastToAdmins(notifyMsg);
                }

                plugin.getApiClient().logCommand(
                        player.getUsername(),
                        player.getUniqueId().toString(),
                        rawCommand,
                        server,
                        true,
                        null
                );
            }).schedule();
        }
    }

    @Subscribe(order = PostOrder.FIRST)
    public void onCommandExecute(CommandExecuteEvent event) {
        if (!plugin.getConfig().isEnabled()) {
            return;
        }

        // Debug: log todos los comandos ejecutados
        if (plugin.getConfig().isDebug()) {
            plugin.getLogger().info("[DEBUG] Comando ejecutado: " + event.getCommand() + " por: " +
                (event.getCommandSource() instanceof Player ? ((Player) event.getCommandSource()).getUsername() : "Console"));
        }

        // Solo procesar comandos de jugadores
        if (!(event.getCommandSource() instanceof Player player)) {
            return;
        }

        String rawCommand = event.getCommand().trim();
        String command = rawCommand.toLowerCase();
        String[] parts = command.split(" ");
        String baseCommand = parts[0];

        // Verificar si es un comando protegido
        if (!isProtectedCommand(baseCommand, parts)) {
            return;
        }

        plugin.getLogger().info("[FurrPerms] Comando protegido detectado: " + rawCommand + " por " + player.getUsername());

        // NO verificar bypass permission - la whitelist del módulo es la única fuente de verdad

        // Verificar con la API (síncrono - bloquea brevemente pero es necesario para seguridad)
        String server = player.getCurrentServer()
                .map(serverConn -> serverConn.getServerInfo().getName())
                .orElse("unknown");

        boolean allowed = plugin.getApiClient().checkCommand(
                player.getUsername(),
                player.getUniqueId().toString(),
                baseCommand,
                server
        );

        plugin.getLogger().info("[FurrPerms] API respondió: " + (allowed ? "PERMITIDO" : "BLOQUEADO"));

        if (allowed) {
            // Comando permitido, loggear y notificar en background
            plugin.getServer().getScheduler().buildTask(plugin, () -> {
                if (plugin.getConfig().notifyAllowed()) {
                    String notifyMsg = plugin.getMessageUtil().getMessage("fur_perms_notify_allowed")
                            .replace("{player}", player.getUsername())
                            .replace("{command}", rawCommand)
                            .replace("{server}", server);
                    plugin.getMessageUtil().broadcastToAdmins(notifyMsg);
                }

                plugin.getApiClient().logCommand(
                        player.getUsername(),
                        player.getUniqueId().toString(),
                        rawCommand,
                        server,
                        true,
                        null
                );
            }).schedule();
            // No modificar event.setResult() permite el comando
        } else {
            // Comando bloqueado
            String reason = "No autorizado";

            // Loggear y notificar en background
            plugin.getServer().getScheduler().buildTask(plugin, () -> {
                plugin.getApiClient().logCommand(
                        player.getUsername(),
                        player.getUniqueId().toString(),
                        rawCommand,
                        server,
                        false,
                        reason
                );

                // Notificar al jugador
                String blockMsg = plugin.getMessageUtil().getMessage("fur_perms_command_blocked")
                        .replace("{command}", rawCommand);
                plugin.getMessageUtil().sendMessage(player, blockMsg);

                // Notificar admins
                if (plugin.getConfig().notifyBlocked()) {
                    String notifyMsg = plugin.getMessageUtil().getMessage("fur_perms_notify_blocked")
                            .replace("{player}", player.getUsername())
                            .replace("{command}", rawCommand)
                            .replace("{server}", server);
                    plugin.getMessageUtil().broadcastToAdmins(notifyMsg);
                }
            }).schedule();

            plugin.getLogger().info("[FurrPerms] Comando BLOQUEADO: " + player.getUsername() + " intentó ejecutar: " + rawCommand);
            event.setResult(CommandResult.denied());
        }
    }

    private boolean isProtectedCommand(String baseCommand, String[] parts) {
        // Verificar comandos base protegidos
        if (PROTECTED_BASE_COMMANDS.contains(baseCommand)) {
            return true;
        }

        // Verificar subcomandos de luckperms (lp user, lp group, lp permission, etc)
        if (baseCommand.equals("lp")) {
            if (parts.length >= 2) {
                String subcommand = parts[1];
                return Set.of("user", "group", "permission", "verbose", "editor", "export", "import",
                        "create", "delete", "set", "unset", "clear").contains(subcommand);
            }
        }

        // Verificar comandos configurados custom
        String configuredCommands = plugin.getConfig().getProtectedCommands().toLowerCase();
        if (!configuredCommands.isEmpty()) {
            String[] customCommands = configuredCommands.split(",");
            for (String customCmd : customCommands) {
                String trimmed = customCmd.trim();
                if (trimmed.contains(" ")) {
                    // Reconstruir el comando completo desde parts
                    String fullCommand = String.join(" ", parts);
                    if (fullCommand.startsWith(trimmed)) {
                        return true;
                    }
                } else if (baseCommand.equals(trimmed)) {
                    return true;
                }
            }
        }

        return false;
    }
}
