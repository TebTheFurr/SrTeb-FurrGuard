package org.grinch.furrsecurity.platform;

import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.command.CommandMeta;
import com.velocitypowered.api.event.EventManager;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.command.VelocityCommandWrapper;
import org.grinch.furrsecurity.listener.VelocityListener;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Velocity platform handler implementation
 */
public class VelocityHandler implements PlatformHandler {

    private final FurrSecurity plugin;
    private final Object velocityPlugin;
    private final ProxyServer server;

    /**
     * Create a new VelocityHandler
     *
     * @param plugin         The FurrSecurity plugin instance
     * @param velocityPlugin The Velocity plugin object (for scheduler)
     * @param server         The ProxyServer instance
     */
    public VelocityHandler(FurrSecurity plugin, Object velocityPlugin, ProxyServer server) {
        this.plugin = plugin;
        this.velocityPlugin = velocityPlugin;
        this.server = server;
    }

    @Override
    public void initialize() {
        // Register listeners
        EventManager eventManager = server.getEventManager();
        VelocityListener listener = new VelocityListener(plugin, server);
        eventManager.register(velocityPlugin, listener);

        plugin.getLogger().info("Velocity platform handler initialized");
    }

    @Override
    public void shutdown() {
        // Velocity handles this automatically
    }

    @Override
    public void registerCommand(FurrSecurityCommand command) {
        CommandManager commandManager = server.getCommandManager();
        CommandMeta meta = commandManager.metaBuilder("furrsecurity")
                .aliases("fsec", "fs")
                .plugin(velocityPlugin)
                .build();
        commandManager.register(meta, new VelocityCommandWrapper(command));
    }

    @Override
    public UUID getPlayerUUID(String playerName) {
        return server.getPlayer(playerName)
                .map(Player::getUniqueId)
                .orElse(null);
    }

    @Override
    public List<String> getOnlinePlayerNames() {
        return server.getAllPlayers().stream()
                .map(Player::getUsername)
                .collect(Collectors.toList());
    }

    @Override
    public String getPlayerName(UUID uuid) {
        return server.getPlayer(uuid)
                .map(Player::getUsername)
                .orElse(null);
    }

    @Override
    public boolean hasPermission(UUID uuid, String permission) {
        return server.getPlayer(uuid)
                .map(player -> player.hasPermission(permission))
                .orElse(false);
    }

    @Override
    public boolean isPlayerOnline(UUID uuid) {
        return server.getPlayer(uuid).isPresent();
    }

    @Override
    public void sendMessage(UUID uuid, String message) {
        server.getPlayer(uuid).ifPresent(player -> {
            Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(message);
            player.sendMessage(component);
        });
    }

    @Override
    public void sendClickableLink(UUID uuid, String message, String url) {
        server.getPlayer(uuid).ifPresent(player -> {
            // Replace {url} placeholder with the actual URL as clickable text
            String displayText = message.replace("{url}", url);

            Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(displayText)
                    .clickEvent(ClickEvent.openUrl(url));

            player.sendMessage(component);
        });
    }

    @Override
    public void broadcastToPermission(String permission, String message) {
        Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(message);
        for (Player player : server.getAllPlayers()) {
            if (player.hasPermission(permission)) {
                player.sendMessage(component);
            }
        }
    }

    @Override
    public void kickPlayer(UUID uuid, String reason) {
        server.getPlayer(uuid).ifPresent(player -> {
            Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(reason);
            player.disconnect(component);
        });
    }

    @Override
    public String getPlayerIP(UUID uuid) {
        return server.getPlayer(uuid)
                .map(player -> player.getRemoteAddress().getAddress().getHostAddress())
                .orElse(null);
    }

    @Override
    public void runAsync(Runnable task) {
        server.getScheduler().buildTask(velocityPlugin, task).schedule();
    }

    @Override
    public Object runAsyncLater(Runnable task, long delayTicks) {
        // Velocity uses milliseconds, convert from ticks (20 ticks = 1 second)
        long delayMs = delayTicks * 50;
        return server.getScheduler().buildTask(velocityPlugin, task)
                .delay(delayMs, TimeUnit.MILLISECONDS)
                .schedule();
    }

    @Override
    public Object runAsyncTimer(Runnable task, long delayTicks, long periodTicks) {
        long delayMs = delayTicks * 50;
        long periodMs = periodTicks * 50;
        return server.getScheduler().buildTask(velocityPlugin, task)
                .delay(delayMs, TimeUnit.MILLISECONDS)
                .repeat(periodMs, TimeUnit.MILLISECONDS)
                .schedule();
    }

    @Override
    public void runSync(Runnable task) {
        // Velocity is async by default
        runAsync(task);
    }

    @Override
    public Object runSyncLater(Runnable task, long delayTicks) {
        return runAsyncLater(task, delayTicks);
    }

    @Override
    public Object runSyncTimer(Runnable task, long delayTicks, long periodTicks) {
        return runAsyncTimer(task, delayTicks, periodTicks);
    }

    @Override
    public void cancelTask(Object task) {
        if (task instanceof ScheduledTask) {
            ((ScheduledTask) task).cancel();
        }
    }

    public ProxyServer getServer() {
        return server;
    }
}
