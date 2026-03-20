package org.grinch.furrsecurity.listener;

import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Monster;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryInteractEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.*;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.manager.PlayerLockManager;

import java.util.UUID;

/**
 * Paper event listener for FurrSecurity
 */
public class PaperListener implements Listener {

    private final FurrSecurity plugin;

    public PaperListener(FurrSecurity plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (!plugin.getConfig().isEnabled()) return;

        // In proxy mode, Velocity handles token generation but Paper still needs to lock players
        boolean proxyMode = plugin.getConfig().isProxyMode();

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        String username = player.getName();
        String ip = player.getAddress().getAddress().getHostAddress();

        // Check if player has staff permissions
        boolean isStaff = player.isOp() ||
                player.hasPermission("*") ||
                player.hasPermission("furrsecurity.staff") ||
                player.hasPermission("furrguard.*");

        if (isStaff) {
            // Apply blindness effect while locked (will be removed when verified)
            applyVerificationBlindness(player);

            // Check verification status
            // In proxy mode, use proxy-aware session check (no token generation, just lock and poll)
            plugin.getVerificationManager().checkSession(uuid, username, ip, proxyMode);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        String username = player.getName();

        plugin.getVerificationManager().onPlayerDisconnect(uuid, username);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerMove(PlayerMoveEvent event) {
        if (!plugin.getConfig().isLockMovement()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            // Only block actual movement, not head rotation
            if (event.getFrom().getX() != event.getTo().getX() ||
                    event.getFrom().getY() != event.getTo().getY() ||
                    event.getFrom().getZ() != event.getTo().getZ()) {

                // Check if player moved significantly
                PlayerLockManager.LocationData lastLoc = plugin.getPlayerLockManager().getLastLocation(uuid);
                if (lastLoc != null) {
                    // Teleport back to last location
                    event.setTo(new org.bukkit.Location(
                            event.getTo().getWorld(),
                            lastLoc.x, lastLoc.y, lastLoc.z,
                            lastLoc.yaw, lastLoc.pitch
                    ));
                } else {
                    event.setCancelled(true);
                }

                // Send message occasionally (not every tick)
                if (System.currentTimeMillis() % 5000 < 100) {
                    sendLockedMessage(player, "locked_movement");
                }
            }
        } else {
            // Update last location
            org.bukkit.Location loc = event.getTo();
            plugin.getPlayerLockManager().setLastLocation(
                    uuid, loc.getX(), loc.getY(), loc.getZ(),
                    loc.getYaw(), loc.getPitch(),
                    loc.getWorld().getName()
            );
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
        if (!plugin.getConfig().isLockCommands()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            String command = event.getMessage().toLowerCase();
            // Allow only furrsecurity commands
            if (!command.startsWith("/furrsecurity") &&
                    !command.startsWith("/fsec") &&
                    !command.startsWith("/fs")) {
                event.setCancelled(true);
                sendLockedMessage(player, "locked_command");
            }
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInventoryClick(InventoryClickEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        if (event.getWhoClicked() instanceof Player) {
            Player player = (Player) event.getWhoClicked();
            UUID uuid = player.getUniqueId();

            if (plugin.getPlayerLockManager().isLocked(uuid)) {
                event.setCancelled(true);
                sendLockedMessage(player, "locked_inventory");
            }
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInventoryInteract(InventoryInteractEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        if (event.getWhoClicked() instanceof Player) {
            Player player = (Player) event.getWhoClicked();
            UUID uuid = player.getUniqueId();

            if (plugin.getPlayerLockManager().isLocked(uuid)) {
                event.setCancelled(true);
            }
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInventoryOpen(InventoryOpenEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        if (event.getPlayer() instanceof Player) {
            Player player = (Player) event.getPlayer();
            UUID uuid = player.getUniqueId();

            if (plugin.getPlayerLockManager().isLocked(uuid)) {
                // Close any open inventory and block opening new ones
                event.setCancelled(true);
                player.closeInventory();
                sendLockedMessage(player, "locked_inventory");
            }
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        if (!plugin.getConfig().isLockChat()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            event.setCancelled(true);
            // Need to send message on main thread
            plugin.getPlatformHandler().runSync(() ->
                    sendLockedMessage(player, "locked_chat"));
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerInteract(PlayerInteractEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            if (event.getAction() == Action.RIGHT_CLICK_BLOCK ||
                    event.getAction() == Action.RIGHT_CLICK_AIR) {
                event.setCancelled(true);
                sendLockedMessage(player, "locked_inventory");
            }
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerDropItem(PlayerDropItemEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerPickupItem(PlayerPickupItemEvent event) {
        if (!plugin.getConfig().isLockInventory()) return;

        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();

        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            event.setCancelled(true);
        }
    }

    private void sendLockedMessage(Player player, String messageKey) {
        String message = plugin.getMessageUtil().prefixed(messageKey);
        player.sendMessage(org.bukkit.ChatColor.translateAlternateColorCodes('&', message));
    }
}
