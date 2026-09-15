package org.grinch.furrguard.common.command;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Set;

import static org.grinch.furrguard.common.command.CommandNormalizer.KNOWN_PERMISSION_LABELS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommandNormalizerTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "/luckperms:lp user X permission set *",
            "/permission set x true",
            "/permissions user X",
            "/lpv user X parent set admin",
            "/luckpermsvelocity user X",
            "/lpb user X",
            "/execute run op X",
            "/minecraft:execute as @a run lp user X permission set *",
            "/execute as @a at @s if entity @s[tag=x] run luckperms user X",
            // mayusculas y espacios
            "   /LuckPerms:LP   USER X   ",
            "/EXECUTE   AS @a RUN   OP bob",
            "/ lp user X",
            "//lp user X",
            "lp user X",
            "/Minecraft:Op bob",
            // ejecutar como otro
            "/sudo Bob lp user Bob parent set admin",
            "/esudo Bob op Bob",
            "/essentials:sudo Bob minecraft:op Bob",
            "/minecraft:sudo bob /op bob",
            "/cmi sudo Bob lp user Bob permission set *",
            // anidados y un jugador llamado "run"
            "/execute as @a run sudo Bob execute run lp user x",
            "/execute as run run lp user x",
            "/sudo Bob execute as @a run deop Admin",
    })
    void bypassesAreDetected(String command) {
        assertTrue(CommandNormalizer.matchesAny(command, KNOWN_PERMISSION_LABELS),
                () -> command + " → " + CommandNormalizer.rootLabels(command));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/msg Bob lp is cool",
            "/say execute run op",
            "/lpx user X",
            "/tell run lp",
            "/help op",
            "",
            "   ",
            "/",
    })
    void unrelatedCommandsAreNotProtected(String command) {
        assertFalse(CommandNormalizer.matchesAny(command, KNOWN_PERMISSION_LABELS),
                () -> command + " → " + CommandNormalizer.rootLabels(command));
    }

    @Test
    void rootLabelsAreLowercaseWithoutSlashOrNamespace() {
        assertEquals(List.of("lp"), CommandNormalizer.rootLabels("/luckperms:lp user X permission set *"));
        assertEquals(List.of("execute", "lp"),
                CommandNormalizer.rootLabels("/minecraft:execute as @a run lp user X"));
        assertEquals(List.of("sudo", "op"), CommandNormalizer.rootLabels("/sudo Bob op Bob"));
        assertEquals(List.of("lp"), CommandNormalizer.rootLabels("/lp: user"));
        assertEquals(List.of(), CommandNormalizer.rootLabels(null));
    }

    @Test
    void protectedEntriesAreNormalizedToo() {
        Set<String> configured = Set.of("minecraft:op", "/LP", "lp user");

        assertTrue(CommandNormalizer.matchesAny("/op bob", configured));
        assertTrue(CommandNormalizer.matchesAny("/lp info", configured), "'lp user' protege todo lp");
        assertFalse(CommandNormalizer.matchesAny("/op bob", Set.of()));
        assertFalse(CommandNormalizer.matchesAny("/op bob", null));
    }

    @Test
    @Timeout(2)
    void pathologicalNestingIsLinear() {
        String command = "/execute run ".repeat(50_000) + "lp user x";

        assertTrue(CommandNormalizer.matchesAny(command, Set.of("lp")));
    }
}
