package org.grinch.furrGuard.text;

import org.grinch.furrGuard.api.CheckResult;
import org.grinch.furrGuard.api.Reasons;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Valores de los placeholders de kicks y avisos. Todos se insertan como texto plano. */
public final class Placeholders {

    static final String UNKNOWN = "Desconocido";

    private Placeholders() {
    }

    /** Para {@code kick_*}: {id} es el ban_id si lo hay y {reason} el motivo escrito por el admin. */
    public static Map<String, String> kick(String nick, String ip, CheckResult result, String referenceId, Instant now) {
        Map<String, String> values = common(nick, ip, result);
        values.put("id", result.banId() != null ? result.banId() : referenceId);
        values.put("reason", result.blockReason() != null ? result.blockReason() : "Sin especificar");
        values.put("time_remaining", Messages.timeRemaining(result.expiresAt(), now));
        return values;
    }

    /** Para {@code notify_*} y {@code player_blocked}: {reason} es la etiqueta legible del motivo. */
    public static Map<String, String> notice(String nick, String ip, CheckResult result) {
        Map<String, String> values = common(nick, ip, result);
        String blockedName = result.blockedName();
        if (blockedName != null && !blockedName.equalsIgnoreCase(nick)) {
            values.put("player", nick + " (" + blockedName + ")");
        }
        values.put("reason", Reasons.label(result.reason()));
        values.put("block_reason", orEmpty(result.blockReason()));
        values.put("ban_id", orEmpty(result.banId()));
        return values;
    }

    private static Map<String, String> common(String nick, String ip, CheckResult result) {
        CheckResult.IpData data = result.ipData();
        Map<String, String> values = new HashMap<>();
        values.put("player", nick);
        values.put("ip", ip);
        values.put("country", or(data.country(), UNKNOWN));
        values.put("country_code", orEmpty(data.countryCode()));
        values.put("continent", or(data.continentCode(), UNKNOWN));
        values.put("isp", or(data.isp(), or(data.org(), UNKNOWN)));
        values.put("current_country", or(data.country(), UNKNOWN));
        values.put("historical_country", UNKNOWN); // check_player no lo devuelve (§1.3)
        values.put("blocked_name", orEmpty(result.blockedName()));
        return values;
    }

    private static String or(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private static String orEmpty(String value) {
        return or(value, "");
    }
}
