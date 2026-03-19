package org.grinch.furrsecurity.manager;

import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.api.ApiClient;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages the verification flow for players
 */
public class VerificationManager {

    private final FurrSecurity plugin;
    private final Map<UUID, Object> pollingTasks = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> pollingAttempts = new ConcurrentHashMap<>();

    private static final int MAX_POLLING_ATTEMPTS = 120; // 10 minutes at 5s intervals
    private static final int TOKEN_EXPIRATION_SECONDS = 180; // 3 minutes for token to expire

    public VerificationManager(FurrSecurity plugin) {
        this.plugin = plugin;
    }

    /**
     * Start the verification process for a player
     */
    public void startVerification(UUID uuid, String nick, String ip) {
        // Don't start verification if already locked
        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            return;
        }

        // Generate token via API
        plugin.getApiClient().generateToken(uuid.toString(), nick, ip)
                .thenAccept(result -> {
                    if (result.success) {
                        // Store token
                        plugin.getPlayerLockManager().setPendingToken(uuid, result.token);

                        // Lock player
                        plugin.getPlayerLockManager().lockPlayer(uuid);

                        // Send verification message
                        Map<String, String> placeholders = Map.of("url", result.verifyUrl);
                        plugin.getPlatformHandler().sendMessage(uuid,
                                plugin.getMessageUtil().prefixed("verification_required"));
                        plugin.getPlatformHandler().sendClickableLink(uuid,
                                plugin.getMessageUtil().prefixed("verification_link", placeholders),
                                result.verifyUrl);

                        // Notify admins
                        if (plugin.getConfig().isNotifyAdmins()) {
                            Map<String, String> adminPlaceholders = Map.of("player", nick);
                            plugin.getPlatformHandler().broadcastToPermission(
                                    plugin.getConfig().getAdminPermission(),
                                    plugin.getMessageUtil().prefixed("admin_notification", adminPlaceholders));
                        }

                        // Start polling for verification status
                        startPolling(uuid, result.token);

                        plugin.getLogger().info("Started verification for " + nick + " (" + uuid + ")");
                    } else {
                        plugin.getLogger().warning("Failed to generate token for " + nick + ": " + result.error);
                    }
                });
    }

    /**
     * Start polling for verification status
     */
    private void startPolling(UUID uuid, String token) {
        pollingAttempts.put(uuid, 0);

        Runnable pollTask = () -> {
            int attempts = pollingAttempts.getOrDefault(uuid, 0);
            if (attempts >= MAX_POLLING_ATTEMPTS) {
                stopPolling(uuid);
                plugin.getLogger().info("Polling timeout for " + uuid);
                return;
            }

            pollingAttempts.put(uuid, attempts + 1);

            plugin.getApiClient().verifyTokenStatus(token).thenAccept(status -> {
                if (status.verified) {
                    onVerificationComplete(uuid, status);
                } else if (status.tokenExpired) {
                    onTokenExpired(uuid, token);
                }
            });
        };

        // Run every 5 seconds and store the task
        Object task = plugin.getPlatformHandler().runAsyncTimer(pollTask, 0, 100); // 100 ticks = 5 seconds
        pollingTasks.put(uuid, task);
    }

    /**
     * Stop polling for a player
     */
    public void stopPolling(UUID uuid) {
        Object task = pollingTasks.remove(uuid);
        if (task != null) {
            plugin.getPlatformHandler().cancelTask(task);
        }
        pollingAttempts.remove(uuid);
    }

    /**
     * Called when verification is complete
     */
    private void onVerificationComplete(UUID uuid, ApiClient.TokenStatus status) {
        // Stop polling first to prevent duplicate calls
        stopPolling(uuid);

        // Check if player is still locked (prevents duplicate unlock)
        if (!plugin.getPlayerLockManager().isLocked(uuid)) {
            return;
        }

        // Unlock player
        plugin.getPlayerLockManager().unlockPlayer(uuid);

        // Send success message
        plugin.getPlatformHandler().sendMessage(uuid,
                plugin.getMessageUtil().prefixed("verification_success"));

        // Start session timer
        plugin.getSessionManager().startSession(uuid);

        plugin.getLogger().info("Verification complete for " + uuid);
    }

    /**
     * Called when verification token expires without verification
     */
    private void onTokenExpired(UUID uuid, String token) {
        // Stop polling first
        stopPolling(uuid);

        // Check if player is still locked
        if (!plugin.getPlayerLockManager().isLocked(uuid)) {
            return;
        }

        String nick = plugin.getPlatformHandler().getPlayerName(uuid);
        String ip = plugin.getPlatformHandler().getPlayerIP(uuid);

        plugin.getLogger().warning("Token expired for " + nick + " (" + uuid + ") without verification");

        // Record failed attempt and check if should be blacklisted
        plugin.getApiClient().recordFailedAttempt(uuid.toString(), nick, ip)
                .thenAccept(result -> {
                    if (result.success && result.blacklisted) {
                        // Player was auto-blacklisted after 3 failed attempts
                        plugin.getLogger().warning(nick + " has been auto-blacklisted after 3 failed verification attempts");
                        plugin.getPlatformHandler().kickPlayer(uuid,
                                plugin.getMessageUtil().get("kick_blacklisted"));
                    } else {
                        // Normal kick for single failed attempt
                        plugin.getPlatformHandler().kickPlayer(uuid,
                                plugin.getMessageUtil().get("kick_unverified"));
                    }
                });

        // Unlock player (they will be kicked anyway)
        plugin.getPlayerLockManager().unlockPlayer(uuid);
    }

    /**
     * Check if a player has a valid session
     */
    public void checkSession(UUID uuid, String nick, String ip) {
        checkSession(uuid, nick, ip, false);
    }

    /**
     * Check if a player has a valid session
     * @param proxyMode If true, don't generate token (Velocity handles that), just lock and poll for session
     */
    public void checkSession(UUID uuid, String nick, String ip, boolean proxyMode) {
        plugin.getApiClient().checkStatus(uuid.toString(), nick, ip)
                .thenAccept(status -> {
                    if (!status.needsVerification) {
                        // Player has valid session or is not staff
                        if ("already_verified".equals(status.reason)) {
                            // Start session timer
                            plugin.getSessionManager().startSession(uuid);
                        }
                    } else {
                        // Player needs verification
                        if (proxyMode) {
                            // In proxy mode: lock player and poll for session (Velocity generates token)
                            startProxyModeVerification(uuid, nick, ip);
                        } else {
                            // Normal mode: generate token and start verification
                            startVerification(uuid, nick, ip);
                        }
                    }
                });
    }

    /**
     * Start verification in proxy mode (no token generation, just lock and poll for session)
     * Used when Paper is behind Velocity - Velocity handles token generation and messaging
     */
    private void startProxyModeVerification(UUID uuid, String nick, String ip) {
        // Don't start verification if already locked
        if (plugin.getPlayerLockManager().isLocked(uuid)) {
            return;
        }

        // Lock player (Velocity handles messaging, Paper only locks)
        plugin.getPlayerLockManager().lockPlayer(uuid);

        // Start polling for session status (instead of token status)
        startProxyModePolling(uuid, nick, ip);

        plugin.getLogger().info("Started proxy mode verification for " + nick + " (" + uuid + ") - Velocity handles messaging");
    }

    /**
     * Start polling for session status in proxy mode
     * In proxy mode, Velocity handles token expiration and kicking
     */
    private void startProxyModePolling(UUID uuid, String nick, String ip) {
        pollingAttempts.put(uuid, 0);

        Runnable pollTask = () -> {
            int attempts = pollingAttempts.getOrDefault(uuid, 0);
            if (attempts >= MAX_POLLING_ATTEMPTS) {
                stopPolling(uuid);
                plugin.getLogger().info("Proxy mode polling timeout for " + uuid);
                return;
            }

            pollingAttempts.put(uuid, attempts + 1);

            // Poll session status instead of token status
            plugin.getApiClient().getSession(uuid.toString()).thenAccept(sessionInfo -> {
                if (sessionInfo.hasSession && sessionInfo.timeRemaining > 0) {
                    onProxyModeVerificationComplete(uuid, sessionInfo);
                }
            });
        };

        // Run every 5 seconds and store the task
        Object task = plugin.getPlatformHandler().runAsyncTimer(pollTask, 0, 100); // 100 ticks = 5 seconds
        pollingTasks.put(uuid, task);
    }

    /**
     * Called when verification is complete in proxy mode
     */
    private void onProxyModeVerificationComplete(UUID uuid, ApiClient.SessionInfo sessionInfo) {
        // Stop polling first to prevent duplicate calls
        stopPolling(uuid);

        // Check if player is still locked (prevents duplicate unlock)
        if (!plugin.getPlayerLockManager().isLocked(uuid)) {
            return;
        }

        // Unlock player
        plugin.getPlayerLockManager().unlockPlayer(uuid);

        // Send success message
        plugin.getPlatformHandler().sendMessage(uuid,
                plugin.getMessageUtil().prefixed("verification_success"));

        // Start session timer
        plugin.getSessionManager().startSession(uuid);

        plugin.getLogger().info("Proxy mode verification complete for " + uuid);
    }

    /**
     * Handle player disconnect
     */
    public void onPlayerDisconnect(UUID uuid, String nick) {
        stopPolling(uuid);
        plugin.getPlayerLockManager().unlockPlayer(uuid);
        plugin.getSessionManager().endSession(uuid);

        // Notify API
        plugin.getApiClient().playerDisconnect(uuid.toString(), nick);
    }

    /**
     * Cleanup all verification tasks
     */
    public void shutdown() {
        pollingTasks.values().forEach(task -> {
            if (task != null) {
                plugin.getPlatformHandler().cancelTask(task);
            }
        });
        pollingTasks.clear();
        pollingAttempts.clear();
    }
}
