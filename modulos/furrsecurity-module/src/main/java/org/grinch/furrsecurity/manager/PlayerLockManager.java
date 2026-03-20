package org.grinch.furrsecurity.manager;

import org.grinch.furrsecurity.FurrSecurity;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages locked players who need verification
 */
public class PlayerLockManager {

    private final FurrSecurity plugin;

    // Players locked pending verification
    private final Set<UUID> lockedPlayers = ConcurrentHashMap.newKeySet();

    // Pending verification tokens
    private final Map<UUID, String> pendingTokens = new ConcurrentHashMap<>();

    // Last location for movement blocking (Paper only)
    private final Map<UUID, LocationData> lastLocations = new ConcurrentHashMap<>();

    public PlayerLockManager(FurrSecurity plugin) {
        this.plugin = plugin;
    }

    /**
     * Lock a player (prevent actions until verified)
     */
    public void lockPlayer(UUID uuid) {
        if (lockedPlayers.contains(uuid)) {
            return; // Already locked
        }
        lockedPlayers.add(uuid);

        // Apply blindness effect when locked (Paper only)
        plugin.getPlatformHandler().applyBlindness(uuid);

        String nick = plugin.getPlatformHandler().getPlayerName(uuid);
        plugin.getLogger().info("Locked player: " + (nick != null ? nick : uuid));
    }

    /**
     * Unlock a player (verification complete)
     */
    public void unlockPlayer(UUID uuid) {
        boolean wasLocked = lockedPlayers.remove(uuid);
        if (!wasLocked) {
            return; // Wasn't locked
        }
        pendingTokens.remove(uuid);
        lastLocations.remove(uuid);

        // Remove blindness effect after verification (Paper only)
        plugin.getPlatformHandler().removeBlindness(uuid);

        String nick = plugin.getPlatformHandler().getPlayerName(uuid);
        plugin.getLogger().info("Unlocked player: " + (nick != null ? nick : uuid));
    }

    /**
     * Check if a player is locked
     */
    public boolean isLocked(UUID uuid) {
        return lockedPlayers.contains(uuid);
    }

    /**
     * Set the pending verification token for a player
     */
    public void setPendingToken(UUID uuid, String token) {
        pendingTokens.put(uuid, token);
    }

    /**
     * Get the pending verification token for a player
     */
    public String getPendingToken(UUID uuid) {
        return pendingTokens.get(uuid);
    }

    /**
     * Remove pending token
     */
    public void removePendingToken(UUID uuid) {
        pendingTokens.remove(uuid);
    }

    /**
     * Store last known location for movement check
     */
    public void setLastLocation(UUID uuid, double x, double y, double z, float yaw, float pitch, String world) {
        lastLocations.put(uuid, new LocationData(x, y, z, yaw, pitch, world));
    }

    /**
     * Get last known location
     */
    public LocationData getLastLocation(UUID uuid) {
        return lastLocations.get(uuid);
    }

    /**
     * Clear all locks (for shutdown/reload)
     */
    public void clearAll() {
        lockedPlayers.clear();
        pendingTokens.clear();
        lastLocations.clear();
    }

    /**
     * Get count of locked players
     */
    public int getLockedCount() {
        return lockedPlayers.size();
    }

    /**
     * Simple location data class for movement blocking
     */
    public static class LocationData {
        public final double x, y, z;
        public final float yaw, pitch;
        public final String world;

        public LocationData(double x, double y, double z, float yaw, float pitch, String world) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.yaw = yaw;
            this.pitch = pitch;
            this.world = world;
        }

        public double distanceSquared(LocationData other) {
            if (!world.equals(other.world)) return Double.MAX_VALUE;
            double dx = x - other.x;
            double dy = y - other.y;
            double dz = z - other.z;
            return dx * dx + dy * dy + dz * dz;
        }
    }
}
