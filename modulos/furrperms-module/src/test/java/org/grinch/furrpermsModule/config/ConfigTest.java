package org.grinch.furrpermsModule.config;

import org.grinch.furrguard.common.config.YamlConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigTest {

    @TempDir
    Path dir;

    private Config load(String yaml) throws IOException {
        Path file = dir.resolve("config.yml");
        Files.writeString(file, yaml);
        YamlConfig.LoadResult result = YamlConfig.load(file);
        assertTrue(result.ok(), result.error());
        return Config.from(result.config());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "lp user Bob permission set *",
            "luckperms:lp user Bob parent add admin",
            "/luckperms:lp user Bob",
            "permission user Bob",
            "lpv user Bob",
            "luckpermsvelocity editor",
            "vperms user Bob",
            "lpb user Bob",
            "OP Bob",
            "minecraft:op Bob",
            "deop Bob",
            "execute run op Bob",
            "minecraft:execute as @a run lp user Bob",
            "sudo Bob op Bob",
            "pex user Bob add *"})
    void theBuiltInListCoversAliasesNamespacesAndWrappers(String command) throws IOException {
        assertTrue(load("").isProtected(command), command);
    }

    @ParameterizedTest
    @ValueSource(strings = {"login secreto", "lobby", "msg Bob op", "helpop necesito ayuda", ""})
    void otherCommandsAreNotTouched(String command) throws IOException {
        assertFalse(load("").isProtected(command), command);
    }

    @Test
    void anOldCsvConfigStillProtectsEverythingBuiltInAndAddsItsOwn() throws IOException {
        Config config = load("api-key: \"clave-1x\"\ncommands:\n  protected: \"op,lp,lp user,myperms\"\n");

        assertTrue(config.isProtected("luckpermsvelocity user Bob"), "la 1.x no lo tenia: sigue protegido");
        assertTrue(config.isProtected("myperms grant Bob"));
        assertEquals("clave-1x", config.apiKey());
        assertEquals(Config.DEFAULT_API_URL, config.apiUrl());
    }

    @Test
    void theApiUrlIsConfigurable() throws IOException {
        Config config = load("api:\n  url: \"https://fg.example/api/plugin.php\"\n  key: \"k\"\n");

        assertEquals("https://fg.example/api/plugin.php", config.apiUrl());
        assertEquals("k", config.apiKey());
    }
}
