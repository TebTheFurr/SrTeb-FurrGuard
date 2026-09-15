package org.grinch.furrpermsModule.access;

import com.google.gson.JsonParser;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Failure;
import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccessDecisionTest {

    @ParameterizedTest
    @EnumSource(Kind.class)
    void anyApiFailureDenies(Kind kind) {
        AccessDecision decision = AccessDecision.from(new Failure(kind, 0, "x", 0));

        assertFalse(decision.allowed());
        assertEquals("fur_perms_unavailable", decision.messageKey());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"allowed\":true,\"reason\":\"ok\"}                      | true  | ok                 | fur_perms_command_blocked",
            "{\"allowed\":true,\"reason\":\"module_disabled\"}         | true  | module_disabled    | fur_perms_command_blocked",
            "{\"allowed\":false,\"reason\":\"not_whitelisted\"}        | false | not_whitelisted    | fur_perms_command_blocked",
            "{\"allowed\":false,\"reason\":\"uuid_mismatch\"}          | false | uuid_mismatch      | fur_perms_uuid_mismatch",
            "{\"allowed\":false,\"reason\":\"needs_furrsecurity\"}     | false | needs_furrsecurity | fur_perms_needs_furrsecurity",
            "{\"allowed\":true,\"reason\":\"needs_furrsecurity\"}      | false | needs_furrsecurity | fur_perms_needs_furrsecurity",
            "{\"allowed\":\"1\"}                                       | true  | ok                 | fur_perms_command_blocked",
            "{\"reason\":\"ok\"}                                       | false | unavailable        | fur_perms_unavailable"})
    void reasonsFromTheContract(String body, boolean allowed, String reason, String messageKey) {
        AccessDecision decision = AccessDecision.from(ok(body));

        assertEquals(allowed, decision.allowed());
        assertEquals(reason, decision.reason());
        assertEquals(messageKey, decision.messageKey());
    }

    @Test
    void aDisabledModuleIsNeitherLoggedNorNotified() {
        assertTrue(AccessDecision.from(ok("{\"allowed\":true,\"reason\":\"module_disabled\"}")).moduleDisabled());
        assertFalse(AccessDecision.from(ok("{\"allowed\":true,\"reason\":\"ok\"}")).moduleDisabled());
    }

    private static ApiResult ok(String json) {
        return new Success(200, JsonParser.parseString(json).getAsJsonObject());
    }
}
