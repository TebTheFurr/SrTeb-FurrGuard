package org.grinch.furrGuard.listener;

import com.velocitypowered.api.event.EventTask;
import com.velocitypowered.api.event.PostOrder;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PreLoginEvent;
import com.velocitypowered.api.event.player.ServerConnectedEvent;
import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.api.response.CheckPlayerResponse;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class ConnectionListener {

    private final FurrGuard plugin;

    private static final Set<String> SPANISH_SPEAKING_COUNTRIES = Set.of(
            "ES", "MX", "AR", "CO", "PE", "VE", "CL", "EC", "GT", "CU",
            "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "GQ"
    );

    public ConnectionListener(FurrGuard plugin) {
        this.plugin = plugin;
    }

    @Subscribe(order = PostOrder.EARLY)
    public EventTask onPreLogin(PreLoginEvent event) {
        if (!plugin.getConfig().isEnabled()) {
            return null;
        }

        if (plugin.getLicenseManager() != null && !plugin.getLicenseManager().isLicensed()) {
            return null;
        }

        String username = event.getUsername();
        InetSocketAddress address = event.getConnection().getRemoteAddress();
        String ip = address.getAddress().getHostAddress();

        int protocolVersion = event.getConnection().getProtocolVersion().getProtocol();
        String gameVersion = getGameVersion(protocolVersion);

        if (plugin.getConfig().isDebug()) {
            plugin.getLogger().info("[DEBUG] PreLogin: {} desde {} (v{})", username, ip, gameVersion);
        }

        return EventTask.async(() -> {
            try {
                CheckPlayerResponse response = plugin.getApiClient()
                        .checkPlayer(null, username, ip, gameVersion)
                        .get(plugin.getConfig().getApiTimeout() + 1000, TimeUnit.MILLISECONDS);

                if (!response.isSuccess()) {
                    plugin.getLogger().error("Error al verificar {}: {} - CONEXIÓN DENEGADA", username, response.getError());
                    String id = generateId();
                    Component kickComponent = plugin.getMessageUtil().parseMessage(
                        plugin.getMessageUtil().getMessage("kick_api_error", "&c✘ Error de verificación. Inténtalo más tarde.")
                            .replace("{id}", id)
                    );
                    event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
                    return;
                }

                if (!response.isAllowed()) {
                    String kickMessage = getKickMessage(response);
                    Component kickComponent = plugin.getMessageUtil().parseMessage(kickMessage);
                    event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
                    plugin.getLogger().info("Bloqueado {} ({}): {}", username, ip, response.getReason());

                    String notifyMessage = getBlockedNotifyMessage(response, username, ip);
                    broadcastToAdmins(notifyMessage);
                } else {
                    plugin.getApiClient().storePreLoginData(username, response);

                    if (plugin.getConfig().isDebug()) {
                        String info = "whitelisted".equals(response.getReason()) ? " [WHITELIST]" : "";
                        plugin.getLogger().info("[DEBUG] Permitido: {} desde {} ({}){}", username, response.getCountry(), response.getIsp(), info);
                    }
                }

            } catch (TimeoutException e) {
                plugin.getLogger().error("Timeout al verificar {}, conexión DENEGADA por seguridad", username);
                String id = generateId();
                Component kickComponent = plugin.getMessageUtil().parseMessage(
                    plugin.getMessageUtil().getMessage("kick_timeout", "&c✘ Tiempo de espera agotado.")
                        .replace("{id}", id)
                );
                event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                plugin.getLogger().error("Interrupción verificando {}, conexión DENEGADA", username);
                String id = generateId();
                Component kickComponent = plugin.getMessageUtil().parseMessage(
                    plugin.getMessageUtil().getMessage("kick_interrupted", "&c✘ Error de verificación.")
                        .replace("{id}", id)
                );
                event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
            } catch (ExecutionException e) {
                String cause = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
                plugin.getLogger().error("Error de ejecución verificando {}: {} - CONEXIÓN DENEGADA", username, cause);
                String id = generateId();
                Component kickComponent = plugin.getMessageUtil().parseMessage(
                    plugin.getMessageUtil().getMessage("kick_execution_error", "&c✘ Error de verificación.")
                        .replace("{id}", id)
                );
                event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
            } catch (CompletionException e) {
                String cause = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
                plugin.getLogger().error("Error de completitud verificando {}: {} - CONEXIÓN DENEGADA", username, cause);
                String id = generateId();
                Component kickComponent = plugin.getMessageUtil().parseMessage(
                    plugin.getMessageUtil().getMessage("kick_completion_error", "&c✘ Error de verificación.")
                        .replace("{id}", id)
                );
                event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
            } catch (Exception e) {
                plugin.getLogger().error("Error inesperado verificando {}: {} - CONEXIÓN DENEGADA", username, e.getMessage());
                String id = generateId();
                Component kickComponent = plugin.getMessageUtil().parseMessage(
                    plugin.getMessageUtil().getMessage("kick_unknown_error", "&c✘ Error de verificación.")
                        .replace("{id}", id)
                );
                event.setResult(PreLoginEvent.PreLoginComponentResult.denied(kickComponent));
            }
        });
    }

    @Subscribe
    public void onServerConnected(ServerConnectedEvent event) {
        Player player = event.getPlayer();
        String ip = player.getRemoteAddress().getAddress().getHostAddress();
        String username = player.getUsername();

        plugin.getApiClient().notifyPlayerJoin(player.getUniqueId(), username, ip);

        boolean notifyConnections = "1".equals(plugin.getMessageUtil().getSetting("notify_connections", "0"));
        boolean notifyHispanicOnly = "1".equals(plugin.getMessageUtil().getSetting("notify_hispanic", "0"));

        if (!notifyConnections && !notifyHispanicOnly) {
            plugin.getApiClient().consumePreLoginData(username);
            return;
        }

        CheckPlayerResponse preLoginData = plugin.getApiClient().consumePreLoginData(username);
        if (preLoginData != null) {
            String country = preLoginData.getCountry() != null ? preLoginData.getCountry() : "Desconocido";
            String countryCode = preLoginData.getCountryCode() != null ? preLoginData.getCountryCode() : "";
            String isp = preLoginData.getIsp() != null ? preLoginData.getIsp() : "";

            boolean isHispanic = SPANISH_SPEAKING_COUNTRIES.contains(countryCode.toUpperCase());

            boolean shouldNotify;
            String messageKey;

            if (notifyHispanicOnly && !notifyConnections) {
                shouldNotify = !isHispanic;
                messageKey = "notify_non_hispanic_join";
            } else if (notifyConnections) {
                shouldNotify = true;
                messageKey = isHispanic ? "notify_player_join" : "notify_non_hispanic_join";
            } else {
                shouldNotify = false;
                messageKey = "notify_player_join";
            }

            if (shouldNotify) {
                String message = plugin.getMessageUtil().getMessage(messageKey);
                message = message
                        .replace("{player}", username)
                        .replace("{ip}", ip)
                        .replace("{country}", country)
                        .replace("{country_code}", countryCode)
                        .replace("{isp}", isp);

                broadcastToAdmins(message);
            }
        }
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        Player player = event.getPlayer();
        plugin.getApiClient().notifyPlayerQuit(player.getUniqueId());
    }

    private void broadcastToAdmins(String message) {
        plugin.broadcastToAdmins(message);
    }

    private String generateId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
    }

    private String getKickMessage(CheckPlayerResponse response) {
        String reason = response.getReason();
        String message;
        String id = generateId();

        if ("blacklisted".equals(reason)) {
            String banId = response.getBanId() != null ? response.getBanId() : id;
            message = plugin.getMessageUtil().getMessage("kick_blacklisted")
                    .replace("{reason}", response.getBlockReason() != null ? response.getBlockReason() : "Sin especificar")
                    .replace("{time_remaining}", formatTimeRemaining(response.getExpiresAt()))
                    .replace("{id}", banId);
        } else {
            message = switch (reason) {
                case "proxy_detected" -> plugin.getMessageUtil().getMessage("kick_proxy").replace("{id}", id);
                case "vpn_detected" -> plugin.getMessageUtil().getMessage("kick_vpn").replace("{id}", id);
                case "hosting_detected" -> plugin.getMessageUtil().getMessage("kick_hosting").replace("{id}", id);
                case "mobile_detected" -> plugin.getMessageUtil().getMessage("kick_mobile").replace("{id}", id);
                case "blocked_provider" -> plugin.getMessageUtil().getMessage("kick_blocked_provider")
                        .replace("{isp}", response.getIsp() != null ? response.getIsp() : "Desconocido")
                        .replace("{id}", id);
                case "blocked_country" -> plugin.getMessageUtil().getMessage("kick_country_blocked")
                        .replace("{country}", response.getCountry() != null ? response.getCountry() : "Desconocido")
                        .replace("{id}", id);
                default -> plugin.getMessageUtil().getMessage("kick_default").replace("{id}", id);
            };
        }

        message = plugin.getMessageUtil().applyGlobalPlaceholders(message);
        return message;
    }

    private String formatTimeRemaining(String expiresAt) {
        if (expiresAt == null || expiresAt.isEmpty()) {
            return " &cpermanentemente";
        }
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            LocalDateTime expiry = LocalDateTime.parse(expiresAt, formatter);
            LocalDateTime now = LocalDateTime.now();
            Duration duration = Duration.between(now, expiry);

            if (duration.isNegative() || duration.isZero()) {
                return " &cpermanentemente";
            }

            long days = duration.toDays();
            long hours = duration.toHours() % 24;
            long minutes = duration.toMinutes() % 60;

            StringBuilder sb = new StringBuilder(" &e temporalmente");
            sb.append("\n&8║   &7Tiempo restante: &f");
            if (days > 0) sb.append(days).append("d ");
            if (hours > 0) sb.append(hours).append("h ");
            sb.append(minutes).append("m");
            return sb.toString();
        } catch (Exception e) {
            return " &cpermanentemente";
        }
    }

    private String getBlockedNotifyMessage(CheckPlayerResponse response, String username, String ip) {
        String playerDisplay = username;
        if (response.getBlockedName() != null && !response.getBlockedName().isEmpty()) {
            playerDisplay = username + " &7(" + response.getBlockedName() + ")";
        }

        String reason = response.getReason();
        String messageKey = switch (reason) {
            case "blacklisted" -> "notify_blacklisted";
            case "proxy_detected" -> "notify_proxy_blocked";
            case "vpn_detected" -> "notify_vpn_blocked";
            case "hosting_detected" -> "notify_hosting_blocked";
            case "blocked_provider" -> "notify_provider_blocked";
            case "blocked_country" -> "notify_country_blocked";
            default -> "notify_proxy_blocked";
        };

        String message = plugin.getMessageUtil().getMessage(messageKey);
        message = message
                .replace("{player}", playerDisplay)
                .replace("{ip}", ip)
                .replace("{isp}", response.getIsp() != null ? response.getIsp() : "Desconocido")
                .replace("{country}", response.getCountry() != null ? response.getCountry() : "Desconocido")
                .replace("{country_code}", response.getCountryCode() != null ? response.getCountryCode() : "")
                .replace("{ban_id}", response.getBanId() != null ? response.getBanId() : "");

        return message;
    }

    private String getGameVersion(int protocol) {
        return switch (protocol) {
            // 1.21.x
            case 774 -> "1.21.4";
            case 769 -> "1.21.2-1.21.3";
            case 768 -> "1.21-1.21.1";
            // 1.20.x
            case 767 -> "1.20.5-1.20.6";
            case 766 -> "1.20.4";
            case 765 -> "1.20.3";
            case 764 -> "1.20.2";
            case 763 -> "1.20-1.20.1";
            // 1.19.x
            case 762 -> "1.19.4";
            case 761 -> "1.19.3";
            case 760 -> "1.19.1-1.19.2";
            case 759 -> "1.19";
            // 1.18.x
            case 758 -> "1.18.2";
            case 757 -> "1.18-1.18.1";
            // 1.17.x
            case 756 -> "1.17.1";
            case 755 -> "1.17";
            // 1.16.x
            case 754 -> "1.16.4-1.16.5";
            case 753 -> "1.16.2-1.16.3";
            case 751 -> "1.16.1";
            case 736 -> "1.16";
            // 1.15.x
            case 578 -> "1.15.2";
            case 575 -> "1.15.1";
            case 573 -> "1.15";
            // 1.14.x
            case 498 -> "1.14.4";
            case 490 -> "1.14.3";
            case 485 -> "1.14.2";
            case 480 -> "1.14.1";
            case 477 -> "1.14";
            // 1.13.x
            case 404 -> "1.13.2";
            case 393 -> "1.13-1.13.1";
            // 1.12.x
            case 340 -> "1.12.2";
            case 335 -> "1.12-1.12.1";
            // 1.11.x
            case 316 -> "1.11.1-1.11.2";
            case 315 -> "1.11";
            // 1.10.x
            case 210 -> "1.10-1.10.2";
            // 1.9.x
            case 110 -> "1.9.3-1.9.4";
            case 109 -> "1.9.2";
            case 108 -> "1.9.1";
            case 107 -> "1.9";
            // 1.8.x
            case 47 -> "1.8-1.8.9";
            // Unknown
            default -> "Unknown (" + protocol + ")";
        };
    }
}
