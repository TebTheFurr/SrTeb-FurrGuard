package org.grinch.furrguard.common.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YamlConfigTest {

    @TempDir
    Path dir;

    private YamlConfig.LoadResult loadText(String yaml) throws IOException {
        Path file = dir.resolve("config.yml");
        Files.writeString(file, yaml, StandardCharsets.UTF_8);
        return YamlConfig.load(file);
    }

    @Test
    void longListAcceptsIntegerLongAndString() throws IOException {
        // 3600 → Integer, 99999999999 → Long, "60" → String: antes esto lanzaba ClassCastException
        YamlConfig config = loadText("alert-times:\n  - 3600\n  - 99999999999\n  - \"60\"\n  - abc\n  - 1.5\n")
                .config();

        List<Long> times = config.longList("alert-times", List.of());

        assertEquals(List.of(3600L, 99999999999L, 60L), times);
        long sum = 0;
        for (long time : times) { // el bucle de SessionManager: unboxing a long
            sum += time;
        }
        assertEquals(3600L + 99999999999L + 60L, sum);
    }

    @Test
    void listsAlsoAcceptCsvStrings() throws IOException {
        YamlConfig config = loadText("alert-times: \"3600, 1800,30\"\ncommands:\n  protected: \"op, lp,,lpv\"\n")
                .config();

        assertEquals(List.of(3600L, 1800L, 30L), config.longList("alert-times", List.of()));
        assertEquals(List.of("op", "lp", "lpv"), config.stringList("commands.protected", List.of()));
        assertEquals(List.of(1L), config.longList("missing", List.of(1L)));
    }

    @Test
    void brokenYamlDoesNotThrowAndReportsReadableError() {
        YamlConfig.LoadResult result = assertDoesNotThrow(() -> loadText("api:\n  url: [unclosed\n  key: \"x\n"));

        assertFalse(result.ok());
        assertNotNull(result.error());
        assertTrue(result.error().contains("config.yml"), result.error());
        assertEquals("def", result.config().string("api.url", "def"), "config vacia: defectos");
    }

    @Test
    void unsafeTagsAreRejectedBySafeConstructor() throws IOException {
        YamlConfig.LoadResult result = loadText("x: !!javax.script.ScriptEngineManager [!!java.net.URLClassLoader [[]]]\n");

        assertFalse(result.ok());
    }

    @Test
    void nonMapRootAndMissingFileAreErrors() throws IOException {
        assertFalse(loadText("- a\n- b\n").ok());
        YamlConfig.LoadResult missing = YamlConfig.load(dir.resolve("nope.yml"));
        assertFalse(missing.ok());
        assertTrue(missing.error().contains("nope.yml"), missing.error());
        assertFalse(YamlConfig.load(null).ok());
    }

    @Test
    void emptyFileIsAnEmptyConfig() throws IOException {
        YamlConfig.LoadResult result = loadText("");

        assertTrue(result.ok());
        assertTrue(result.config().bool("enabled", true));
    }

    @Test
    void dottedGettersAndTypeMismatches() throws IOException {
        YamlConfig config = loadText("enabled: yes\ndebug: \"false\"\napi:\n  url: https://x\n  timeout: 5000\n"
                + "  big: 99999999999\nlock:\n  movement: 1\n  chat: maybe\nsection: {a: 1}\n").config();

        assertTrue(config.bool("enabled", false));
        assertFalse(config.bool("debug", true));
        assertTrue(config.bool("lock.movement", false));
        assertTrue(config.bool("lock.chat", true), "valor no booleano: defecto");
        assertEquals("https://x", config.string("api.url", ""));
        assertEquals(5000, config.integer("api.timeout", 0));
        assertEquals(-1, config.integer("api.big", -1), "fuera de rango int");
        assertEquals(99999999999L, config.longValue("api.big", -1));
        assertEquals("def", config.string("section", "def"), "un mapa no es un escalar");
        assertEquals("def", config.string("api.url.deeper", "def"));
        assertEquals(7, config.integer("", 7));
    }

    @Test
    void copiesDefaultsFromResourceOnlyWhenMissing() throws IOException {
        Path file = dir.resolve("sub/config.yml");
        ClassLoader loader = getClass().getClassLoader();

        YamlConfig.LoadResult first = YamlConfig.load(file, loader, "furrguard-common-test-defaults.yml");
        assertTrue(first.ok(), String.valueOf(first.error()));
        assertEquals(List.of(3600L, 60L), first.config().longList("alert-times", List.of()));

        Files.writeString(file, "alert-times: [5]\n", StandardCharsets.UTF_8);
        YamlConfig.LoadResult second = YamlConfig.load(file, loader, "furrguard-common-test-defaults.yml");
        assertEquals(List.of(5L), second.config().longList("alert-times", List.of()), "no se sobrescribe");

        YamlConfig.LoadResult noResource = YamlConfig.load(dir.resolve("other.yml"), loader, "no-existe.yml");
        assertFalse(noResource.ok());
        assertTrue(noResource.error().contains("no-existe.yml"), noResource.error());
    }
}
