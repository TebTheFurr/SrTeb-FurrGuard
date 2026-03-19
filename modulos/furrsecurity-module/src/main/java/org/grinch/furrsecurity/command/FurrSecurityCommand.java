package org.grinch.furrsecurity.command;

import org.grinch.furrsecurity.FurrSecurity;

import java.util.*;

/**
 * Command handler for FurrSecurity - Platform-agnostic logic
 */
public class FurrSecurityCommand {

    private final FurrSecurity plugin;

    public FurrSecurityCommand(FurrSecurity plugin) {
        this.plugin = plugin;
    }

    public FurrSecurity getPlugin() {
        return plugin;
    }

    /**
     * Handle command execution
     */
    public void handleCommand(CommandSenderWrapper sender, String[] args) {
        if (args.length == 0) {
            sendHelp(sender);
            return;
        }

        String subCommand = args[0].toLowerCase();

        switch (subCommand) {
            case "reload":
                handleReload(sender);
                break;
            case "status":
                handleStatus(sender);
                break;
            case "check":
                handleCheck(sender, args);
                break;
            case "reset":
                handleReset(sender, args);
                break;
            case "stats":
                handleStats(sender);
                break;
            case "help":
            default:
                sendHelp(sender);
                break;
        }
    }

    /**
     * Handle tab completion
     */
    public List<String> handleTabComplete(String[] args) {
        List<String> completions = new ArrayList<>();

        if (args.length == 1) {
            completions.addAll(Arrays.asList("reload", "status", "check", "reset", "stats", "help"));
        } else if (args.length == 2) {
            String subCommand = args[0].toLowerCase();
            if (subCommand.equals("check") || subCommand.equals("reset")) {
                completions.addAll(getOnlinePlayerNames());
            }
        }

        String lastArg = args[args.length - 1].toLowerCase();
        completions.removeIf(s -> !s.toLowerCase().startsWith(lastArg));

        return completions;
    }

    private List<String> getOnlinePlayerNames() {
        return plugin.getPlatformHandler().getOnlinePlayerNames();
    }

    private void sendHelp(CommandSenderWrapper sender) {
        sender.sendMessage("&8&m------------------&c FurrSecurity &8&m------------------");
        sender.sendMessage("&c/fsec reload &7- Recargar configuracion");
        sender.sendMessage("&c/fsec status &7- Ver estado del modulo");
        sender.sendMessage("&c/fsec check <player> &7- Verificar estado de jugador");
        sender.sendMessage("&c/fsec reset <player> &7- Resetear sesion de jugador");
        sender.sendMessage("&c/fsec stats &7- Ver estadisticas");
        sender.sendMessage("&8&m------------------------------------------------");
    }

    private void handleReload(CommandSenderWrapper sender) {
        if (!sender.hasPermission("furrsecurity.admin")) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("no_permission"));
            return;
        }

        plugin.getConfig().load();
        sender.sendMessage(plugin.getMessageUtil().prefixed("reload_success"));
    }

    private void handleStatus(CommandSenderWrapper sender) {
        if (!sender.hasPermission("furrsecurity.admin")) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("no_permission"));
            return;
        }

        sender.sendMessage("&8&m------------------&c FurrSecurity Status &8&m------------------");
        sender.sendMessage("&7Enabled: " + (plugin.getConfig().isEnabled() ? "&aYes" : "&cNo"));
        sender.sendMessage("&7Platform: &f" + plugin.getPlatform().name());
        sender.sendMessage("&7Locked players: &f" + plugin.getPlayerLockManager().getLockedCount());
        sender.sendMessage("&8&m-----------------------------------------------------");
    }

    private void handleCheck(CommandSenderWrapper sender, String[] args) {
        if (!sender.hasPermission("furrsecurity.admin")) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("no_permission"));
            return;
        }

        if (args.length < 2) {
            sender.sendMessage("&cUsage: /fsec check <player>");
            return;
        }

        String playerName = args[1];
        UUID uuid = plugin.getPlatformHandler().getPlayerUUID(playerName);

        if (uuid == null) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("player_not_found"));
            return;
        }

        boolean locked = plugin.getPlayerLockManager().isLocked(uuid);
        boolean hasSession = plugin.getSessionManager().hasActiveSession(uuid);
        long remaining = plugin.getSessionManager().getRemainingTime(uuid);

        sender.sendMessage("&8&m----------------&c " + playerName + " &8&m----------------");
        sender.sendMessage("&7Locked: " + (locked ? "&cYes" : "&aNo"));
        sender.sendMessage("&7Has session: " + (hasSession ? "&aYes" : "&cNo"));
        if (hasSession) {
            sender.sendMessage("&7Time remaining: &f" + plugin.getMessageUtil().formatTime(remaining));
        }
        sender.sendMessage("&8&m--------------------------------------------");
    }

    private void handleReset(CommandSenderWrapper sender, String[] args) {
        if (!sender.hasPermission("furrsecurity.admin")) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("no_permission"));
            return;
        }

        if (args.length < 2) {
            sender.sendMessage("&cUsage: /fsec reset <player>");
            return;
        }

        String playerName = args[1];
        UUID uuid = plugin.getPlatformHandler().getPlayerUUID(playerName);

        if (uuid == null) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("player_not_found"));
            return;
        }

        sender.sendMessage("&7Reseteando sesion de &f" + playerName + "&7...");

        // End local session
        plugin.getSessionManager().endSession(uuid);
        plugin.getPlayerLockManager().unlockPlayer(uuid);

        // Reset session in database via API
        String uuidStr = uuid.toString();
        plugin.getApiClient().resetSession(uuidStr, playerName).thenAccept(result -> {
            if (result.success) {
                sender.sendMessage("&a&l✔ &7Sesion reseteada correctamente.");
                sender.sendMessage("&7Sesiones expiradas: &f" + result.sessionsExpired);

                // If player is online, start verification process
                if (plugin.getPlatformHandler().isPlayerOnline(uuid)) {
                    String ip = plugin.getPlatformHandler().getPlayerIP(uuid);
                    plugin.getVerificationManager().startVerification(uuid, playerName, ip);
                    sender.sendMessage("&7El jugador debe verificar nuevamente.");
                }
            } else {
                sender.sendMessage("&c&l✘ &7Error al resetear sesion: " + (result.error != null ? result.error : "Unknown error"));
            }
        });
    }

    private void handleStats(CommandSenderWrapper sender) {
        if (!sender.hasPermission("furrsecurity.admin")) {
            sender.sendMessage(plugin.getMessageUtil().prefixed("no_permission"));
            return;
        }

        sender.sendMessage("&8&m----------------&c FurrSecurity Stats &8&m----------------");
        sender.sendMessage("&7Locked players: &f" + plugin.getPlayerLockManager().getLockedCount());
        sender.sendMessage("&7Platform: &f" + plugin.getPlatform().name());
        sender.sendMessage("&8&m----------------------------------------------------");
    }

    /**
     * Command sender wrapper interface - platform agnostic
     */
    public interface CommandSenderWrapper {
        void sendMessage(String message);
        boolean hasPermission(String permission);
    }
}
