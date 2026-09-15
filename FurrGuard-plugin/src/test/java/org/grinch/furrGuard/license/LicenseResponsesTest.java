package org.grinch.furrGuard.license;

import org.grinch.furrGuard.license.LicenseResponses.Verdict;
import org.grinch.furrGuard.license.LicenseResponses.Verification;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LicenseResponsesTest {

    private static final String VALID_BODY = """
            {"success":true,"instance_id":"i-1","license":{"plugin_id":"furrguard","plugin_name":"FurrGuard",
             "discord_id":"123456789012345678","discord_username":"grinch","role":"owner","max_servers":3,
             "active_servers":1,"is_lifetime":false,"expires_at":"2027-01-01 00:00:00"}}
            """;

    @Test
    void validLicenseIsParsedWithGson() {
        Verification verification = LicenseResponses.parseVerify(200, VALID_BODY);

        assertEquals(Verdict.VALID, verification.verdict());
        assertEquals("grinch", verification.license().discordUsername());
        assertEquals(3, verification.license().maxServers());
        assertFalse(verification.license().lifetime()); // la regex antigua lo daba siempre por lifetime
        assertFalse(LicenseResponses.shouldDeleteKey(verification));
    }

    @Test
    void retryableFailureIsNotAValidLicense() {
        // El parser antiguo veia "success" y un "true" (el de can_retry) y lo daba por valida
        Verification verification = LicenseResponses.parseVerify(200,
                "{\"success\":false,\"error\":\"database_error\",\"can_retry\":true}");

        assertEquals(Verdict.RETRY, verification.verdict());
        assertFalse(LicenseResponses.shouldDeleteKey(verification));
    }

    @ParameterizedTest
    @ValueSource(ints = {200, 401, 403, 404, 410})
    void explicitRejectionDeletesTheKey(int status) {
        Verification verification = LicenseResponses.parseVerify(status,
                "{\"success\":false,\"error\":\"license_revoked\",\"message\":\"Licencia revocada\"}");

        assertEquals(Verdict.INVALID, verification.verdict());
        assertTrue(LicenseResponses.shouldDeleteKey(verification));
        assertEquals("HTTP " + status + " license_revoked", verification.error());
    }

    @ParameterizedTest
    @ValueSource(ints = {408, 429, 500, 502, 503, 504})
    void serverTroubleNeverDeletesTheKey(int status) {
        Verification verification = LicenseResponses.parseVerify(status, "{\"success\":false,\"error\":\"x\"}");

        assertEquals(Verdict.RETRY, verification.verdict());
        assertFalse(LicenseResponses.shouldDeleteKey(verification));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"<html>502 Bad Gateway</html>", "[]", "{\"error\":\"no success field\"}", "{bad json"})
    void unparseableOrIncompleteBodiesAreRetried(String body) {
        assertEquals(Verdict.RETRY, LicenseResponses.parseVerify(200, body).verdict());
    }

    @Test
    void successOutside2xxIsRetried() {
        assertEquals(Verdict.RETRY, LicenseResponses.parseVerify(503, VALID_BODY).verdict());
    }

    @Test
    void licenseFieldsAtTopLevelAreAccepted() {
        Verification verification = LicenseResponses.parseVerify(200,
                "{\"success\":true,\"plugin_name\":\"FurrGuard\",\"is_lifetime\":true}");

        assertEquals("FurrGuard", verification.license().pluginName());
        assertTrue(verification.license().lifetime());
    }

    @Test
    void gracePeriodCoversRecentVerificationsOnly() {
        long now = 1_000_000_000_000L;
        long grace = LicenseResponses.GRACE_PERIOD.toMillis();

        assertTrue(LicenseResponses.withinGrace(now - grace + 1, now));
        assertFalse(LicenseResponses.withinGrace(now - grace, now));
        assertFalse(LicenseResponses.withinGrace(0, now)); // nunca verificada
        assertTrue(LicenseResponses.withinGrace(now + Duration.ofMinutes(1).toMillis(), now));
        assertFalse(LicenseResponses.withinGrace(now + Duration.ofHours(1).toMillis(), now)); // reloj manipulado
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "200|{\"success\":true,\"link_code\":\"AB12-cd\"}|AB12-cd",
            "200|{\"success\":true,\"link_code\":\"../../x\"}|",
            "200|{\"success\":false,\"link_code\":\"AB12\"}|",
            "500|{\"success\":true,\"link_code\":\"AB12\"}|"})
    void linkCodeMustBeASafeToken(int status, String body, String expected) {
        assertEquals(Optional.ofNullable(expected), LicenseResponses.parseLinkCode(status, body));
    }

    @Test
    void completedLinkNeedsASingleLineKey() {
        assertTrue(LicenseResponses.parseLinkStatus(200,
                "{\"status\":\"completed\",\"api_key_encrypted\":\"abc==\",\"instance_id\":\"i-1\"}").completed());
        assertFalse(LicenseResponses.parseLinkStatus(200,
                "{\"status\":\"completed\",\"api_key_encrypted\":\"abc\\nkey=evil\"}").completed());
        assertTrue(LicenseResponses.parseLinkStatus(200, "{\"status\":\"expired\"}").expired());
        assertNull(LicenseResponses.parseLinkStatus(0, null).status());
    }

    @Test
    void updateIsOnlyReportedWhenFlagged() {
        assertEquals("2.1.0", LicenseResponses.parseUpdate(200,
                "{\"has_update\":true,\"update\":{\"latest_version\":\"2.1.0\",\"download_url\":\"https://x\"}}")
                .orElseThrow().latestVersion());
        assertTrue(LicenseResponses.parseUpdate(200, "{\"has_update\":false}").isEmpty());
    }
}
