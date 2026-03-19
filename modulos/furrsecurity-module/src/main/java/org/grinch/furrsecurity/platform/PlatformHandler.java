package org.grinch.furrsecurity.platform;

import org.grinch.furrsecurity.command.FurrSecurityCommand;

import java.util.List;
import java.util.UUID;

/**
 * Interface for platform-specific operations
 */
public interface PlatformHandler {

    /**
     * Initialize the platform handler
     */
    void initialize();

    /**
     * Shutdown the platform handler
     */
    void shutdown();

    /**
     * Register a command
     */
    void registerCommand(FurrSecurityCommand command);

    /**
     * Get a player's UUID by name
     */
    UUID getPlayerUUID(String playerName);

    /**
     * Get list of online player names
     */
    List<String> getOnlinePlayerNames();

    /**
     * Get a player's name by UUID
     */
    String getPlayerName(UUID uuid);

    /**
     * Check if a player has a specific permission
     */
    boolean hasPermission(UUID uuid, String permission);

    /**
     * Check if a player is online
     */
    boolean isPlayerOnline(UUID uuid);

    /**
     * Send a message to a player
     */
    void sendMessage(UUID uuid, String message);

    /**
     * Send a clickable link to a player
     * @param uuid Player UUID
     * @param message The message to display (may contain {url} placeholder)
     * @param url The URL to open when clicked
     */
    void sendClickableLink(UUID uuid, String message, String url);

    /**
     * Send a message to all players with a specific permission
     */
    void broadcastToPermission(String permission, String message);

    /**
     * Kick a player with a specific reason
     */
    void kickPlayer(UUID uuid, String reason);

    /**
     * Get the player's IP address
     */
    String getPlayerIP(UUID uuid);

    /**
     * Get the platform-specific scheduler for running tasks
     */
    void runAsync(Runnable task);

    Object runAsyncLater(Runnable task, long delayTicks);

    Object runAsyncTimer(Runnable task, long delayTicks, long periodTicks);

    void runSync(Runnable task);

    Object runSyncLater(Runnable task, long delayTicks);

    Object runSyncTimer(Runnable task, long delayTicks, long periodTicks);

    void cancelTask(Object task);
}
