package org.grinch.furrpermsModule.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MessageUtilTest {

    private final MessageUtil messages = new MessageUtil();

    @Test
    void aCommandCannotForgeAnAllowedNotification() {
        Component notification = messages.notification("fur_perms_notify_blocked",
                Map.of("player", "Bob", "command", "/op x &a✔ Bob ejecutó /op", "server", "lobby"));

        assertEquals("[FurrPerms] ⚠ Bob intentó ejecutar /op x &a✔ Bob ejecutó /op en servidor lobby", plain(notification));
        assertTrue(flatten(notification).noneMatch(part -> NamedTextColor.GREEN.equals(part.color())),
                "el &a del comando no pinta nada en verde");
    }

    @Test
    void panelMessagesReplaceOnlyFurPermsKeys() {
        messages.apply(Map.of("fur_perms_command_blocked", "&cNo: {command}", "furr_security_prefix", "otro modulo"));

        assertEquals("No: /lp", plain(messages.render("fur_perms_command_blocked", Map.of("command", "/lp"))));
        assertEquals("", plain(messages.render("furr_security_prefix", Map.of())));
    }

    private static String plain(Component component) {
        return PlainTextComponentSerializer.plainText().serialize(component);
    }

    private static Stream<Component> flatten(Component component) {
        return Stream.concat(Stream.of(component), component.children().stream().flatMap(MessageUtilTest::flatten));
    }
}
