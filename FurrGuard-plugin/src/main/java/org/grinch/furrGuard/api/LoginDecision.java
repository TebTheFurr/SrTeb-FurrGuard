package org.grinch.furrGuard.api;

import org.grinch.furrGuard.config.PluginConfig.FailurePolicy;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Kind;

import java.util.Optional;

/** Que hacer con un login a partir de la respuesta de {@code check_player}. */
public sealed interface LoginDecision permits LoginDecision.Allow, LoginDecision.Deny {

    /** {@code result} null: la API fallo y {@code api.failure-policy: allow} lo deja pasar sin comprobar. */
    record Allow(CheckResult result, String failure) implements LoginDecision {
    }

    /** {@code result} null: denegado por un fallo de la API, descrito en {@code failure}. */
    record Deny(String messageKey, CheckResult result, String failure) implements LoginDecision {
    }

    static LoginDecision of(CheckResult result) {
        return result.allowed()
                ? new Allow(result, null)
                : new Deny(Reasons.kickMessageKey(result.reason()), result, null);
    }

    static LoginDecision of(ApiResult apiResult, FailurePolicy policy) {
        if (apiResult instanceof ApiResult.Success ok) {
            Optional<CheckResult> parsed = CheckResult.parse(ok.body());
            return parsed.isPresent()
                    ? of(parsed.get())
                    : onFailure(Kind.INVALID_RESPONSE, "respuesta sin campo 'allowed'", policy);
        }
        ApiResult.Failure failure = (ApiResult.Failure) apiResult;
        return onFailure(failure.kind(), failure.message(), policy);
    }

    private static LoginDecision onFailure(Kind kind, String message, FailurePolicy policy) {
        String description = switch (kind) {
            case UNAUTHORIZED -> "la API rechazo la clave (revisa api.key): " + message;
            case NOT_CONFIGURED -> "configuracion de la API no valida: " + message;
            default -> kind + ": " + message;
        };
        boolean policyApplies = switch (kind) {
            case NETWORK, TIMEOUT, SERVER_ERROR, RATE_LIMITED, INVALID_RESPONSE -> true;
            case UNAUTHORIZED, NOT_CONFIGURED, CLIENT_ERROR -> false;
        };
        if (policyApplies && policy == FailurePolicy.ALLOW) {
            return new Allow(null, description);
        }
        return new Deny(kind == Kind.TIMEOUT ? "kick_timeout" : "kick_api_error", null, description);
    }
}
