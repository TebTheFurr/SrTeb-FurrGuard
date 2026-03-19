package org.grinch.furrsecurity.platform;

import org.bukkit.Bukkit;
import org.bukkit.Server;
import org.bukkit.command.PluginCommand;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.command.PaperCommandWrapper;
import org.grinch.furrsecurity.listener.PaperListener;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Paper platform handler implementation
 */
public class PaperHandler implements PlatformHandler {

    private final FurrSecurity plugin;
    private final JavaPlugin paperPlugin;

    public PaperHandler(FurrSecurity plugin, Object paperPlugin) {
        this.plugin = plugin;
        this.paperPlugin = (JavaPlugin) paperPlugin;
    }

    @Override
    public void initialize() {
        // Register listeners
        PaperListener listener = new PaperListener(plugin);
        Bukkit.getPluginManager().registerEvents(listener, paperPlugin);

        plugin.getLogger().info("Paper platform handler initialized");
    }

    @Override
    public void shutdown() {
        // Paper handles this automatically
    }

    @Override
    public void registerCommand(FurrSecurityCommand command) {
        PaperCommandWrapper wrapper = new PaperCommandWrapper(command);
        PluginCommand cmd = paperPlugin.getCommand("furrsecurity");
        if (cmd != null) {
            cmd.setExecutor(wrapper);
            cmd.setTabCompleter(wrapper);
        } else {
            // Fallback: register dynamically
            try {
                Server server = Bukkit.getServer();
                java.lang.reflect.Method registerMethod = server.getClass().getMethod(
                        "getCommandMap");
                org.bukkit.command.CommandMap commandMap = (org.bukkit.command.CommandMap)
                        registerMethod.invoke(server);

                final PaperCommandWrapper finalWrapper = wrapper;
                org.bukkit.command.Command bukkitCommand = new org.bukkit.command.Command(
                        "furrsecurity", "FurrSecurity command", "/<command>", java.util.Arrays.asList("fsec", "fs")) {
                    @Override
                    public boolean execute(org.bukkit.command.CommandSender sender, String label, String[] args) {
                        return finalWrapper.onCommand(sender, this, label, args);
                    }

                    @Override
                    public java.util.List<String> tabComplete(org.bukkit.command.CommandSender sender, String alias, String[] args) {
                        return finalWrapper.onTabComplete(sender, this, alias, args);
                    }
                };

                commandMap.register("furrsecurity", bukkitCommand);
            } catch (Exception e) {
                plugin.getLogger().severe("Failed to register command: " + e.getMessage());
            }
        }
    }

    @Override
    public UUID getPlayerUUID(String playerName) {
        Player player = Bukkit.getPlayer(playerName);
        return player != null ? player.getUniqueId() : null;
    }

    @Override
    public List<String> getOnlinePlayerNames() {
        return Bukkit.getOnlinePlayers().stream()
                .map(Player::getName)
                .collect(Collectors.toList());
    }

    @Override
    public String getPlayerName(UUID uuid) {
        Player player = Bukkit.getPlayer(uuid);
        return player != null ? player.getName() : null;
    }

    @Override
    public boolean hasPermission(UUID uuid, String permission) {
        Player player = Bukkit.getPlayer(uuid);
        return player != null && player.hasPermission(permission);
    }

    @Override
    public boolean isPlayerOnline(UUID uuid) {
        return Bukkit.getPlayer(uuid) != null;
    }

    @Override
    public void sendMessage(UUID uuid, String message) {
        Player player = Bukkit.getPlayer(uuid);
        if (player != null) {
            player.sendMessage(org.bukkit.ChatColor.translateAlternateColorCodes('&', message));
        }
    }

    @Override
    public void broadcastToPermission(String permission, String message) {
        String colored = org.bukkit.ChatColor.translateAlternateColorCodes('&', message);
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (player.hasPermission(permission)) {
                player.sendMessage(colored);
            }
        }
    }

    @Override
    public void kickPlayer(UUID uuid, String reason) {
        Player player = Bukkit.getPlayer(uuid);
        if (player != null) {
            player.kickPlayer(org.bukkit.ChatColor.translateAlternateColorCodes('&', reason));
        }
    }

    @Override
    public String getPlayerIP(UUID uuid) {
        Player player = Bukkit.getPlayer(uuid);
        return player != null ? player.getAddress().getAddress().getHostAddress() : null;
    }

    @Override
    public void runAsync(Runnable task) {
        Bukkit.getScheduler().runTaskAsynchronously(paperPlugin, task);
    }

    @Override
    public Object runAsyncLater(Runnable task, long delayTicks) {
        return Bukkit.getScheduler().runTaskLaterAsynchronously(paperPlugin, task, delayTicks);
    }

    @Override
    public Object runAsyncTimer(Runnable task, long delayTicks, long periodTicks) {
        return Bukkit.getScheduler().runTaskTimerAsynchronously(paperPlugin, task, delayTicks, periodTicks);
    }

    @Override
    public void runSync(Runnable task) {
        Bukkit.getScheduler().runTask(paperPlugin, task);
    }

    @Override
    public Object runSyncLater(Runnable task, long delayTicks) {
        return Bukkit.getScheduler().runTaskLater(paperPlugin, task, delayTicks);
    }

    @Override
    public Object runSyncTimer(Runnable task, long delayTicks, long periodTicks) {
        return Bukkit.getScheduler().runTaskTimer(paperPlugin, task, delayTicks, periodTicks);
    }

    @Override
    public void cancelTask(Object task) {
        if (task instanceof org.bukkit.scheduler.BukkitTask) {
            ((org.bukkit.scheduler.BukkitTask) task).cancel();
        } else if (task instanceof Integer) {
            Bukkit.getScheduler().cancelTask((Integer) task);
        }
    }

    public JavaPlugin getPaperPlugin() {
        return paperPlugin;
    }
}
