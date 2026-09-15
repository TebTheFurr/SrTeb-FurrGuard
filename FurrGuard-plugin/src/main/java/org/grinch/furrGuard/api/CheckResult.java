package org.grinch.furrGuard.api;

import com.google.gson.JsonObject;
import org.grinch.furrguard.common.json.Json;

import java.util.Optional;

/**
 * Decision de {@code check_player} (docs/API.md §1.3). Tambien sirve para cada elemento de
 * {@code recheck_players}, que trae los mismos campos sin {@code ip_data}.
 *
 * <p>Los textos ausentes, {@code null} o vacios quedan como {@code null}.
 */
public record CheckResult(
        boolean allowed,
        String reason,
        String blockReason,
        String blockType,
        String expiresAt,
        String banId,
        String blockedName,
        boolean degraded,
        IpData ipData) {

    public record IpData(String country, String countryCode, String continentCode, String isp, String org,
                         String as, boolean proxy, boolean hosting, boolean mobile) {

        public static final IpData EMPTY = new IpData(null, null, null, null, null, null, false, false, false);

        public static IpData parse(JsonObject ip) {
            return new IpData(text(ip, "country"), text(ip, "countryCode"), text(ip, "continentCode"),
                    text(ip, "isp"), text(ip, "org"), text(ip, "as"),
                    Json.bool(ip, "proxy", false), Json.bool(ip, "hosting", false), Json.bool(ip, "mobile", false));
        }

        public boolean isEmpty() {
            return equals(EMPTY);
        }
    }

    /** Vacio si falta {@code allowed}: la respuesta no es una decision y se trata como invalida. */
    public static Optional<CheckResult> parse(JsonObject body) {
        if (Json.str(body, "allowed", null) == null) {
            return Optional.empty();
        }
        boolean allowed = Json.bool(body, "allowed", false); // un valor raro deniega
        String reason = text(body, "reason");
        return Optional.of(new CheckResult(allowed,
                reason != null ? reason : allowed ? Reasons.ALLOWED : "unknown",
                text(body, "block_reason"), text(body, "block_type"), text(body, "expires_at"),
                text(body, "ban_id"), text(body, "blocked_name"), Json.bool(body, "degraded", false),
                IpData.parse(Json.obj(body, "ip_data")))); // Json.obj: [] o null → {}
    }

    /** Solo decisiones completas: sin geolocalizacion degradada ni ip-api caido. */
    public boolean cacheable() {
        return !degraded && !Reasons.IP_API_UNAVAILABLE.equals(reason);
    }

    public CheckResult withIpData(IpData data) {
        return new CheckResult(allowed, reason, blockReason, blockType, expiresAt, banId, blockedName, degraded,
                data == null ? IpData.EMPTY : data);
    }

    private static String text(JsonObject obj, String key) {
        String value = Json.str(obj, key, null);
        return value == null || value.isBlank() ? null : value;
    }
}
