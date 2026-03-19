package org.grinch.furrsecurity.manager;

import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.api.ApiClient;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Manages session timers and countdown alerts
 */
public class SessionManager {

    private final FurrSecurity plugin;
    private final Map<UUID, Long> sessionExpiries = new ConcurrentHashMap<>();
    private final Map<UUID, Map<Long, ScheduledFuture<?>>> alertTasks = new ConcurrentHashMap<>();
    private final Map<UUID, ScheduledFuture<?>> expiryTasks = new ConcurrentHashMap<>();

    public SessionManager(FurrSecurity plugin) {
        this.plugin = plugin;
    }

    /**
     * Start a session for a player
     */
    public void startSession(UUID uuid) {
        // Get session info from API
        plugin.getApiClient().getSession(uuid.toString()).thenAccept(session -> {
            if (session.hasSession) {
                // Validate session time - must be at least 60 seconds
                if (session.timeRemaining < 60) {
                    plugin.getLogger().warning("Session time too short for " + uuid + ": " + session.timeRemaining + "s - skipping session scheduling");
                    return;
                }

                long expiryTime = System.currentTimeMillis() / 1000 + session.timeRemaining;
                sessionExpiries.put(uuid, expiryTime);

                // Schedule alerts
                scheduleAlerts(uuid, session.timeRemaining);

                // Reduced logging - only log once per session start
                String nick = plugin.getPlatformHandler().getPlayerName(uuid);
                plugin.getLogger().info("Session started for " + (nick != null ? nick : uuid) + " (" + session.timeRemaining + "s)");
            }
        });
    }

    /**
     * End a session for a player
     */
    public void endSession(UUID uuid) {
        sessionExpiries.remove(uuid);
        cancelAlerts(uuid);

        ScheduledFuture<?> expiryTask = expiryTasks.remove(uuid);
        if (expiryTask != null) {
            expiryTask.cancel(false);
        }
    }

    /**
     * Get remaining time for a session
     */
    public long getRemainingTime(UUID uuid) {
        Long expiry = sessionExpiries.get(uuid);
        if (expiry == null) return 0;
        return Math.max(0, expiry - System.currentTimeMillis() / 1000);
    }

    /**
     * Check if player has an active session
     */
    public boolean hasActiveSession(UUID uuid) {
        return getRemainingTime(uuid) > 0;
    }

    /**
     * Schedule countdown alerts for a session
     */
    private void scheduleAlerts(UUID uuid, long durationSeconds) {
        // Cancel existing alerts
        cancelAlerts(uuid);

        Map<Long, ScheduledFuture<?>> tasks = new ConcurrentHashMap<>();
        alertTasks.put(uuid, tasks);

        // Schedule alerts at configured times
        for (long alertTime : plugin.getConfig().getAlertTimes()) {
            if (alertTime < durationSeconds) {
                long delaySeconds = durationSeconds - alertTime;
                long delayTicks = delaySeconds * 20; // 20 ticks per second

                ScheduledFuture<?> task = scheduleAlert(uuid, alertTime, delayTicks);
                if (task != null) {
                    tasks.put(alertTime, task);
                }
            }
        }

        // Schedule expiry task
        long expiryTicks = durationSeconds * 20;
        ScheduledFuture<?> expiryTask = scheduleExpiry(uuid, expiryTicks);
        if (expiryTask != null) {
            expiryTasks.put(uuid, expiryTask);
        }
    }

    /**
     * Schedule a single alert
     */
    private ScheduledFuture<?> scheduleAlert(UUID uuid, long alertTime, long delayTicks) {
        // We'll use a simple approach with the platform handler
        // In a real implementation, you'd use a ScheduledExecutorService
        Runnable alertTask = () -> {
            if (!hasActiveSession(uuid)) return;

            String timeStr = plugin.getMessageUtil().formatTime(alertTime);
            Map<String, String> placeholders = Map.of("time", timeStr);

            plugin.getPlatformHandler().sendMessage(uuid,
                    plugin.getMessageUtil().prefixed("session_expiring", placeholders));

            // At 5 minutes, show verification link again
            if (alertTime <= plugin.getConfig().getEarlyVerifyTime()) {
                showEarlyVerifyLink(uuid);
            }
        };

        // Schedule using platform handler (simplified - real impl would use executor)
        plugin.getPlatformHandler().runSyncLater(alertTask, delayTicks);
        return null; // Return actual ScheduledFuture in real implementation
    }

    /**
     * Schedule the session expiry task
     */
    private ScheduledFuture<?> scheduleExpiry(UUID uuid, long delayTicks) {
        // Don't schedule if delay is too short (less than 30 seconds)
        if (delayTicks < 600) { // 30 seconds * 20 ticks
            plugin.getLogger().warning("Skipping expiry task for " + uuid + " - delay too short: " + (delayTicks / 20) + "s");
            return null;
        }

        Runnable expiryTask = () -> {
            if (!hasActiveSession(uuid)) return;

            // Check if player is still online
            if (!plugin.getPlatformHandler().isPlayerOnline(uuid)) {
                return;
            }

            plugin.getPlatformHandler().sendMessage(uuid,
                    plugin.getMessageUtil().prefixed("session_expired"));

            // Lock player and require re-verification
            String nick = plugin.getPlatformHandler().getPlayerName(uuid);
            String ip = plugin.getPlatformHandler().getPlayerIP(uuid);

            sessionExpiries.remove(uuid);
            plugin.getVerificationManager().startVerification(uuid, nick, ip);
        };

        plugin.getPlatformHandler().runSyncLater(expiryTask, delayTicks);
        return null;
    }

    /**
     * Show early verification link
     */
    private void showEarlyVerifyLink(UUID uuid) {
        String token = plugin.getPlayerLockManager().getPendingToken(uuid);
        if (token == null) {
            // Generate new token for early verification
            String nick = plugin.getPlatformHandler().getPlayerName(uuid);
            String ip = plugin.getPlatformHandler().getPlayerIP(uuid);

            plugin.getApiClient().generateToken(uuid.toString(), nick, ip)
                    .thenAccept(result -> {
                        if (result.success) {
                            plugin.getPlayerLockManager().setPendingToken(uuid, result.token);
                            Map<String, String> placeholders = Map.of("url", result.verifyUrl);
                            plugin.getPlatformHandler().sendMessage(uuid,
                                    plugin.getMessageUtil().prefixed("verification_link", placeholders));
                        }
                    });
        } else {
            String verifyUrl = plugin.getConfig().getVerifyUrl() + "?token=" + token;
            Map<String, String> placeholders = Map.of("url", verifyUrl);
            plugin.getPlatformHandler().sendMessage(uuid,
                    plugin.getMessageUtil().prefixed("verification_link", placeholders));
        }
    }

    /**
     * Cancel all alerts for a player
     */
    private void cancelAlerts(UUID uuid) {
        Map<Long, ScheduledFuture<?>> tasks = alertTasks.remove(uuid);
        if (tasks != null) {
            tasks.values().forEach(task -> {
                if (task != null) {
                    task.cancel(false);
                }
            });
        }
    }

    /**
     * Shutdown all sessions
     */
    public void shutdown() {
        sessionExpiries.clear();
        alertTasks.values().forEach(tasks ->
                tasks.values().forEach(task -> {
                    if (task != null) task.cancel(false);
                }));
        alertTasks.clear();
        expiryTasks.values().forEach(task -> {
            if (task != null) task.cancel(false);
        });
        expiryTasks.clear();
    }
}
