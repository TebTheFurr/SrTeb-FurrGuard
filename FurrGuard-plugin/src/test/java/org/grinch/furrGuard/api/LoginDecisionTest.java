package org.grinch.furrGuard.api;

import com.google.gson.JsonParser;
import org.grinch.furrGuard.config.PluginConfig.FailurePolicy;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

class LoginDecisionTest {

    private static ApiResult success(String body) {
        return new ApiResult.Success(200, JsonParser.parseString(body).getAsJsonObject());
    }

    private static ApiResult failure(Kind kind) {
        return new ApiResult.Failure(kind, 0, "detalle", 0);
    }

    @Test
    void allowedResponseAllowsWithTheResult() {
        LoginDecision decision = LoginDecision.of(success("{\"allowed\":true,\"reason\":\"whitelisted\"}"),
                FailurePolicy.DENY);

        LoginDecision.Allow allow = assertInstanceOf(LoginDecision.Allow.class, decision);
        assertEquals("whitelisted", allow.result().reason());
    }

    @Test
    void deniedResponseDeniesWithTheReasonMessage() {
        LoginDecision decision = LoginDecision.of(success("{\"allowed\":false,\"reason\":\"vpn_detected\"}"),
                FailurePolicy.ALLOW);

        LoginDecision.Deny deny = assertInstanceOf(LoginDecision.Deny.class, decision);
        assertEquals("kick_vpn", deny.messageKey());
        assertEquals("vpn_detected", deny.result().reason());
    }

    @ParameterizedTest
    @EnumSource(value = Kind.class, names = {"NETWORK", "TIMEOUT", "SERVER_ERROR", "RATE_LIMITED", "INVALID_RESPONSE"})
    void outagesFollowThePolicy(Kind kind) {
        LoginDecision.Deny deny = assertInstanceOf(LoginDecision.Deny.class,
                LoginDecision.of(failure(kind), FailurePolicy.DENY));
        assertNull(deny.result());
        assertEquals(kind == Kind.TIMEOUT ? "kick_timeout" : "kick_api_error", deny.messageKey());

        LoginDecision.Allow allow = assertInstanceOf(LoginDecision.Allow.class,
                LoginDecision.of(failure(kind), FailurePolicy.ALLOW));
        assertNull(allow.result());
    }

    @ParameterizedTest
    @EnumSource(value = Kind.class, names = {"UNAUTHORIZED", "NOT_CONFIGURED", "CLIENT_ERROR"})
    void badKeyOrConfigAlwaysDenies(Kind kind) {
        assertInstanceOf(LoginDecision.Deny.class, LoginDecision.of(failure(kind), FailurePolicy.ALLOW));
        assertInstanceOf(LoginDecision.Deny.class, LoginDecision.of(failure(kind), FailurePolicy.DENY));
    }

    @Test
    void unauthorizedExplainsTheKeyProblem() {
        LoginDecision.Deny deny = (LoginDecision.Deny) LoginDecision.of(failure(Kind.UNAUTHORIZED), FailurePolicy.ALLOW);

        assertEquals("la API rechazo la clave (revisa api.key): detalle", deny.failure());
    }

    @Test
    void successWithoutDecisionIsAnInvalidResponse() {
        ApiResult noDecision = success("{\"error\":\"oops\"}");

        assertInstanceOf(LoginDecision.Deny.class, LoginDecision.of(noDecision, FailurePolicy.DENY));
        assertInstanceOf(LoginDecision.Allow.class, LoginDecision.of(noDecision, FailurePolicy.ALLOW));
    }
}
