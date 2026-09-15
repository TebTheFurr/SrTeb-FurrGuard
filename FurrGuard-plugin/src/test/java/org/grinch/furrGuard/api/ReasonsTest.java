package org.grinch.furrGuard.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReasonsTest {

    @ParameterizedTest
    @ValueSource(strings = {"blacklisted", "blocked_country", "blocked_continent", "blocked_provider",
            "proxy_detected", "vpn_detected", "hosting_detected", "mobile_detected"})
    void onlyTheContractReasonsKickConnectedPlayers(String reason) {
        assertTrue(Reasons.justifiesKick(reason));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"ip_api_unavailable", "compromised_account", "allowed", "whitelisted", "unknown",
            "BLACKLISTED", "api_error"})
    void outagesErrorsAndEverythingElseNeverKick(String reason) {
        assertFalse(Reasons.justifiesKick(reason));
    }

    @Test
    void mobileHasItsOwnLabelAndNotice() {
        assertEquals("notify_mobile_blocked", Reasons.notifyMessageKey("mobile_detected"));
        assertEquals("Red móvil detectada", Reasons.label("mobile_detected"));
        assertEquals("kick_mobile", Reasons.kickMessageKey("mobile_detected"));
    }

    @Test
    void usesThePanelMessageKeys() {
        assertEquals("kick_blocked_country", Reasons.kickMessageKey("blocked_country"));
        assertEquals("kick_api_error", Reasons.kickMessageKey("ip_api_unavailable"));
        assertEquals("kick_default", Reasons.kickMessageKey("something_new"));
        assertEquals("player_blocked", Reasons.notifyMessageKey("something_new"));
        assertEquals("something_new", Reasons.label("something_new"));
    }
}
