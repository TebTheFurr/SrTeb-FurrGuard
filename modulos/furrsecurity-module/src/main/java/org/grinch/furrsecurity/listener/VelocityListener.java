package org.grinch.furrsecurity.listener;

import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PreLoginEvent;
import com.velocitypowered.api.event.player.PlayerChatEvent;
import com.velocitypowered.api.event.player.ServerConnectedEvent;
import com.velocitypowered.api.event.player.ServerPreConnectEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.grinch.furrsecurity.FurrSecurity;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Velocity event listener for FurrSecurity
 */
public class VelocityListener {

    private final FurrSecurity plugin;
    private final ProxyServer server;

    public VelocityListener(FurrSecurity plugin, ProxyServer server) {
        this.plugin = plugin;
        this.server = server;
    }

    @Subscribe(order = PostOrder.EARLY)
    public void onPreLogin(PreLoginEvent event) {
        if (!plugin.getConfig().isEnabled()) return;

        // Note: UUID is not available at PreLogin stage
        // We'll handle verification after login
        // Removed verbose logging to reduce console spam
    }

    @Subscribe(order = PostOrder.NORMAL)
    public void onServerConnected(ServerConnectedEvent event) {
        if (!plugin.getConfig().isEnabled()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        String username = player.getUsername();
        String ip = player.getRemoteAddress().getAddress().getHostAddress();

        // Check if player has staff permissions (using * or specific permission)
        boolean isStaff = player.hasPermission("*") ||
                player.hasPermission("furrsecurity.staff") ||
                player.hasPermission("furrguard.*");

        if (isStaff) {
            // Small delay to ensure player is fully connected and can receive messages
            server.getScheduler().buildTask(plugin.getPluginObject(), () -> {
                // Only start verification if player is not already locked (prevents duplicates on server switch)
                if (!plugin.getPlayerLockManager().isLocked(uuid)) {
                    plugin.getLogger().info("Staff player connected: " + username + " - checking verification status");
                    // Check verification status
                    plugin.getVerificationManager().checkSession(uuid, username, ip);
                }
            }).delay(500, TimeUnit.MILLISECONDS).schedule();
        }
    }

    @Subscribe(order = PostOrder.LATE)
    public void onDisconnect(DisconnectEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        String username = player.getUsername();

        plugin.getVerificationManager().onPlayerDisconnect(uuid, username);
    }

    @Subscribe(order = PostOrder.EARLY)
    public void onCommand(CommandExecuteEvent event) {
        if (!plugin.getConfig().isLockCommands()) return;

        if (event.getCommandSource() instanceof Player) {
            Player player = (Player) event.getCommandSource();
            UUID uuid = player.getUniqueId();

            if (plugin.getPlayerLockManager().isLocked(uuid)) {
                // Allow only certain commands
                String command = event.getCommand().toLowerCase();
                if (!command.startsWith("furrsecurity") && !command.startsWith("fsec") && !command.startsWith("fs")) {
                    event.setResult(CommandExecuteEvent.CommandResult.denied());
                    sendLockedMessage(player, "locked_command");
                }
            }
        }
    }

    @Subscribe(order = PostOrder.EARLY)
    public void onChat(PlayerChatEvent event) {
        if (!plugin.getConfig().isLockChat()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            event.setResult(PlayerChatEvent.ChatResult.denied());
            sendLockedMessage(player, "locked_chat");
        }
    }

    @Subscribe(order = PostOrder.EARLY)
    public void onServerSwitch(ServerPreConnectEvent event) {
        if (!plugin.getConfig().isLockServerSwitch()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            event.setResult(ServerPreConnectEvent.ServerResult.denied());
            sendLockedMessage(player, "locked_server_switch");
        }
    }

    private void sendLockedMessage(Player player, String messageKey) {
        String message = plugin.getMessageUtil().prefixed(messageKey);
        Component component = LegacyComponentSerializer.legacyAmpersand().deserialize(message);
        player.sendMessage(component);
    }
}
