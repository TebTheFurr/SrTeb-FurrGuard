package org.grinch.furrGuard.api;

import java.util.Map;
import java.util.Set;

/** Motivos de {@code check_player} (docs/API.md §1.3) y lo que el plugin hace con cada uno. */
public final class Reasons {

    public static final String ALLOWED = "allowed";
    public static final String IP_API_UNAVAILABLE = "ip_api_unavailable";

    /** Los unicos motivos que justifican expulsar a alguien ya conectado (§1.3). */
    private static final Set<String> KICK_ON_RECHECK = Set.of("blacklisted", "blocked_country", "blocked_continent",
            "blocked_provider", "proxy_detected", "vpn_detected", "hosting_detected", "mobile_detected");

    private static final Map<String, String> KICK_MESSAGES = Map.of(
            "blacklisted", "kick_blacklisted",
            "proxy_detected", "kick_proxy",
            "vpn_detected", "kick_vpn",
            "hosting_detected", "kick_hosting",
            "mobile_detected", "kick_mobile",
            "blocked_provider", "kick_blocked_provider",
            "blocked_country", "kick_blocked_country",
            "blocked_continent", "kick_blocked_continent",
            "compromised_account", "kick_compromised_account",
            IP_API_UNAVAILABLE, "kick_api_error");

    private static final Map<String, String> NOTIFY_MESSAGES = Map.of(
            "blacklisted", "notify_blacklisted",
            "proxy_detected", "notify_proxy_blocked",
            "vpn_detected", "notify_vpn_blocked",
            "hosting_detected", "notify_hosting_blocked",
            "mobile_detected", "notify_mobile_blocked",
            "blocked_provider", "notify_provider_blocked",
            "blocked_country", "notify_country_blocked",
            "blocked_continent", "notify_continent_blocked",
            "compromised_account", "notify_compromised_account");

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry(ALLOWED, "Permitido"),
            Map.entry("whitelisted", "En lista blanca"),
            Map.entry("blacklisted", "En lista negra"),
            Map.entry("compromised_account", "Cuenta comprometida"),
            Map.entry("proxy_detected", "Proxy detectado"),
            Map.entry("vpn_detected", "VPN detectada"),
            Map.entry("hosting_detected", "Hosting/Datacenter"),
            Map.entry("mobile_detected", "Red móvil detectada"),
            Map.entry("blocked_provider", "Proveedor bloqueado"),
            Map.entry("blocked_country", "País bloqueado"),
            Map.entry("blocked_continent", "Continente bloqueado"),
            Map.entry(IP_API_UNAVAILABLE, "Geolocalización no disponible"));

    private Reasons() {
    }

    public static boolean justifiesKick(String reason) {
        return reason != null && KICK_ON_RECHECK.contains(reason);
    }

    public static String kickMessageKey(String reason) {
        return reason == null ? "kick_default" : KICK_MESSAGES.getOrDefault(reason, "kick_default");
    }

    /** {@code player_blocked} (con {reason}) para motivos sin aviso propio. */
    public static String notifyMessageKey(String reason) {
        return reason == null ? "player_blocked" : NOTIFY_MESSAGES.getOrDefault(reason, "player_blocked");
    }

    public static String label(String reason) {
        return reason == null ? "Desconocido" : LABELS.getOrDefault(reason, reason);
    }
}
