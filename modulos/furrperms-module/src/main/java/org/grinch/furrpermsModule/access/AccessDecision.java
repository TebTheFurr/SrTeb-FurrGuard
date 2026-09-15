package org.grinch.furrpermsModule.access;

import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;

import java.util.Set;

/**
 * Respuesta de {@code check_furr_perms_whitelist} (docs/API.md §1.2). Falla en cerrado: cualquier fallo
 * de la API o una respuesta contradictoria deniega.
 */
public record AccessDecision(boolean allowed, String reason) {

    public static final String UNAVAILABLE = "unavailable";
    public static final AccessDecision COOLDOWN = new AccessDecision(false, "cooldown");
    public static final AccessDecision CACHED_GRANT = new AccessDecision(true, "ok");
    private static final Set<String> DENY_REASONS = Set.of("not_whitelisted", "uuid_mismatch", "needs_furrsecurity");

    public static AccessDecision from(ApiResult result) {
        if (result instanceof Success ok && ok.body().has("allowed")) {
            String reason = Json.str(ok.body(), "reason", "");
            boolean allowed = Json.bool(ok.body(), "allowed", false) && !DENY_REASONS.contains(reason);
            return new AccessDecision(allowed, reason.isBlank() ? (allowed ? "ok" : "not_whitelisted") : reason);
        }
        return new AccessDecision(false, UNAVAILABLE);
    }

    /** El modulo esta apagado en el panel: se permite sin registrar ni avisar. */
    public boolean moduleDisabled() {
        return allowed && "module_disabled".equals(reason);
    }

    /** Mensaje {@code fur_perms_*} para el jugador al que se le deniega. */
    public String messageKey() {
        return switch (reason) {
            case "uuid_mismatch" -> "fur_perms_uuid_mismatch";
            case "needs_furrsecurity" -> "fur_perms_needs_furrsecurity";
            case UNAVAILABLE -> "fur_perms_unavailable";
            case "cooldown" -> "fur_perms_no_permission";
            default -> "fur_perms_command_blocked";
        };
    }
}
