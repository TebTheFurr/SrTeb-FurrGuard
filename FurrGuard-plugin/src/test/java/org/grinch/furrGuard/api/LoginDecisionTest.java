package org.grinch.furrGuard.api;

import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;
import org.grinch.furrGuard.config.PluginConfig.FailurePolicy;
import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiClientConfig;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoginDecisionTest {

    private static final String KEY = "fg_0123456789abcdef0123456789abcdef0123456789abcdef";

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

    /** Respuestas reales del panel por HTTP: con failure-policy allow, una clave mala o ausente nunca deja pasar. */
    @ParameterizedTest
    @CsvSource({
            "503, api_key_not_configured, configuracion de la API no valida: HTTP 503 (api_key_not_configured)",
            "401, invalid_api_key, la API rechazo la clave (revisa api.key): HTTP 401 (invalid_api_key)",
    })
    void panelKeyErrorsDenyEvenWithAllowPolicy(int status, String slug, String expectedFailure) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/api", exchange -> {
            byte[] body = ("{\"error\":\"" + slug + "\",\"message\":\"x\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/plugin.php";
        try (ApiClient client = new ApiClient(ApiClientConfig.builder(url, KEY).allowInsecureHttp(true).build())) {
            ApiResult result = client.post("check_player", Map.of()).get(20, TimeUnit.SECONDS);

            LoginDecision.Deny deny = assertInstanceOf(LoginDecision.Deny.class, LoginDecision.of(result, FailurePolicy.ALLOW));
            assertNull(deny.result());
            assertEquals("kick_api_error", deny.messageKey());
            assertTrue(deny.failure().startsWith(expectedFailure), deny.failure());
        } finally {
            server.stop(0);
        }
    }
}
