package org.grinch.furrsecurity.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrsecurity.support.FakeApi;
import org.grinch.furrsecurity.support.FakePlatform;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class MessagesTest {

    @Test
    void getMessagesIsAFlatObjectAndOnlyFurrSecurityKeysCount() {
        Success reply = FakeApi.ok("{\"furr_security_verification_required\":\"&aVerifica, {player}\","
                + "\"fur_perms_command_blocked\":\"otro modulo\",\"prefix\":\"[FG] \",\"furr_security_\":\"x\"}");

        Messages messages = Messages.defaults().withOverrides(Json.stringMap(reply.body()));

        assertEquals("Verifica, Bob", plain(messages.get("verification_required", "player", "Bob")));
        assertEquals("FurrSecurity | ", plain(messages.get("prefix")));
    }

    @Test
    void panelPlaceholdersVerifyUrlAndTimeRemainingAreFilled() {
        Messages messages = Messages.defaults().withOverrides(Map.of(
                "furr_security_verification_link", "Entra en {verify_url}",
                "furr_security_session_expiring", "Quedan {time_remaining} ({time})"));

        assertEquals("Entra en https://x", plain(messages.get("verification_link", "url", "https://x", "verify_url", "https://x")));
        assertEquals("Quedan 5m (5m)", plain(messages.get("session_expiring", "time", "5m", "time_remaining", "5m")));
    }

    @Test
    void valuesAreNeverFormatAndLiteralNewlinesBecomeRealOnes() {
        Messages messages = Messages.defaults().withOverrides(Map.of("furr_security_kick_unverified", "&cFuera\\n&7vuelve"));

        assertEquals("[FurrSecurity] &a{player} requiere verificacion.",
                plain(messages.get("admin_notification", "player", "&a{player}")));
        assertEquals("Fuera\nvuelve", plain(messages.get("kick_unverified")));
    }

    @Test
    void aBlankMessageFromThePanelSendsNothing() {
        Messages messages = Messages.defaults().withOverrides(Map.of("furr_security_locked_movement", ""));

        assertEquals(Component.empty(), messages.prefixed("locked_movement"));
    }

    @Test
    void onlyWebUrlsBecomeClickable() {
        Component text = Component.text("link");

        assertEquals(ClickEvent.openUrl("https://fg.test/v"), Messages.clickable(text, "https://fg.test/v").clickEvent());
        assertNull(Messages.clickable(text, "javascript:alert(1)").clickEvent());
    }

    @Test
    void timeIsHumanReadable() {
        assertEquals("30s", Messages.formatTime(30));
        assertEquals("4m", Messages.formatTime(240));
        assertEquals("1m 30s", Messages.formatTime(90));
        assertEquals("1h", Messages.formatTime(3600));
        assertEquals("2h 5m", Messages.formatTime(7500));
    }

    private static String plain(Component component) {
        return FakePlatform.plain(component);
    }
}
