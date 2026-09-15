package org.grinch.furrGuard.text;

import com.google.gson.JsonParser;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.grinch.furrGuard.api.CheckResult;
import org.grinch.furrGuard.api.Reasons;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MessagesTest {

    private static final Instant NOW = Instant.parse("2026-09-15T12:00:00Z");
    private final Messages messages = Messages.fromResource(getClass().getClassLoader());

    private static String plain(net.kyori.adventure.text.Component component) {
        return PlainTextComponentSerializer.plainText().serialize(component);
    }

    @Test
    void timeRemainingHasASingleFormat() {
        assertEquals(" permanentemente", Messages.timeRemaining(null, NOW));
        assertEquals(" permanentemente", Messages.timeRemaining(" ", NOW));
        assertEquals(" temporalmente (2d 3h 15m)", Messages.timeRemaining("2026-09-17 15:15:00", NOW));
        assertEquals(" temporalmente (5h 0m)", Messages.timeRemaining("2026-09-15 17:00:00", NOW));
        assertEquals(" temporalmente (1m)", Messages.timeRemaining("2026-09-15 12:00:30", NOW));
        assertEquals(" temporalmente", Messages.timeRemaining("2026-09-15 11:00:00", NOW)); // reloj desfasado
        assertEquals(" temporalmente", Messages.timeRemaining("mañana", NOW));
    }

    @Test
    void expiryIsReadAsUtcWhateverTheProxyTimezone() {
        // 20:00 UTC son 22:00 en Madrid: quedan 8 h, no 6 h
        assertEquals(" temporalmente (8h 0m)", Messages.timeRemaining("2026-09-15 20:00:00", NOW));
    }

    @Test
    void valuesCannotInjectColorCodes() {
        CheckResult result = CheckResult.parse(JsonParser.parseString(
                "{\"allowed\":false,\"reason\":\"blocked_provider\",\"ip_data\":{\"isp\":\"&k&cEvil §4ISP\"}}")
                .getAsJsonObject()).orElseThrow();

        String kick = plain(messages.render("kick_blocked_provider",
                Placeholders.kick("Nick&a", "1.2.3.4", result, "REF", NOW)));

        assertTrue(kick.contains("&k&cEvil &4ISP"), kick);
    }

    @Test
    void panelMessagesOverrideDefaultsAndBlankOnesAreIgnored() {
        messages.updateMessages(Map.of("kick_vpn", "&cSin VPN {id}", "kick_proxy", " "));
        messages.updateSettings(Map.of("server_name", "Tebby"));

        assertEquals("Sin VPN X", plain(messages.render("kick_vpn", Map.of("id", "X"))));
        assertNotEquals(" ", messages.template("kick_proxy"));
        assertTrue(plain(messages.render("kick_proxy", Map.of())).contains("Tebby"));
    }

    @Test
    void everyKeyThePluginUsesHasADefault() {
        List<String> reasons = List.of("blacklisted", "proxy_detected", "vpn_detected", "hosting_detected",
                "mobile_detected", "blocked_provider", "blocked_country", "blocked_continent", "compromised_account",
                "ip_api_unavailable", "whatever");
        for (String reason : reasons) {
            assertHasDefault(Reasons.kickMessageKey(reason));
            assertHasDefault(Reasons.notifyMessageKey(reason));
        }
        for (String key : List.of("prefix", "kick_timeout", "kick_unknown_error", "kick_starting", "kick_unlicensed",
                "notify_player_kicked", "notify_player_join", "notify_non_hispanic_join", "whitelist_added",
                "whitelist_removed", "blacklist_added", "blacklist_removed")) {
            assertHasDefault(key);
        }
    }

    private void assertHasDefault(String key) {
        assertNotEquals(key, messages.template(key), "falta en messages.yml: " + key);
    }
}
