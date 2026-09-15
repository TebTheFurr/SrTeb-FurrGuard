package org.grinch.furrGuard.api;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CheckResultTest {

    private static JsonObject json(String raw) {
        return JsonParser.parseString(raw).getAsJsonObject();
    }

    @Test
    void parsesFullBlacklistResponse() {
        CheckResult result = CheckResult.parse(json("""
                {"allowed":false,"reason":"blacklisted","block_reason":"Griefing","block_type":"uuid",
                 "expires_at":"2026-09-15 20:00:00","ban_id":"AB12CD34EF56","blocked_name":"Original",
                 "degraded":false,"ip_data":{"country":"Spain","countryCode":"ES","continentCode":"EU",
                 "isp":"Telefonica","as":"AS3352 Telefonica","proxy":false,"hosting":true,"mobile":false}}
                """)).orElseThrow();

        assertFalse(result.allowed());
        assertEquals("blacklisted", result.reason());
        assertEquals("Griefing", result.blockReason());
        assertEquals("AB12CD34EF56", result.banId());
        assertEquals("Original", result.blockedName());
        assertEquals("ES", result.ipData().countryCode());
        assertEquals("EU", result.ipData().continentCode());
        assertTrue(result.ipData().hosting());
        assertTrue(result.cacheable());
    }

    @ParameterizedTest
    @ValueSource(strings = {"[]", "null", "\"x\"", "5"})
    void ipDataThatIsNotAnObjectIsEmptyInsteadOfThrowing(String ipData) {
        CheckResult result = CheckResult.parse(json("{\"allowed\":true,\"ip_data\":" + ipData + "}")).orElseThrow();

        assertTrue(result.ipData().isEmpty());
    }

    @Test
    void nullAndWrongTypedFieldsBecomeNull() {
        CheckResult result = CheckResult.parse(json("""
                {"allowed":false,"reason":null,"block_reason":null,"expires_at":null,"ban_id":{},
                 "blocked_name":"","ip_data":{"country":null,"isp":[],"proxy":null}}
                """)).orElseThrow();

        assertEquals("unknown", result.reason());
        assertNull(result.blockReason());
        assertNull(result.expiresAt());
        assertNull(result.banId());
        assertNull(result.blockedName());
        assertNull(result.ipData().country());
        assertNull(result.ipData().isp());
        assertFalse(result.ipData().proxy());
    }

    @Test
    void missingAllowedIsNotADecision() {
        assertEquals(Optional.empty(), CheckResult.parse(json("{\"error\":\"invalid_api_key\"}")));
        assertEquals(Optional.empty(), CheckResult.parse(json("{\"allowed\":null}")));
        assertEquals(Optional.empty(), CheckResult.parse(json("{\"allowed\":{}}")));
    }

    @Test
    void oddAllowedValueDenies() {
        assertFalse(CheckResult.parse(json("{\"allowed\":\"maybe\"}")).orElseThrow().allowed());
        assertTrue(CheckResult.parse(json("{\"allowed\":1}")).orElseThrow().allowed());
    }

    @Test
    void degradedAndIpApiUnavailableAreNotCacheable() {
        assertFalse(CheckResult.parse(json("{\"allowed\":true,\"degraded\":true}")).orElseThrow().cacheable());
        assertFalse(CheckResult.parse(json("{\"allowed\":false,\"reason\":\"ip_api_unavailable\"}")).orElseThrow()
                .cacheable());
    }
}
