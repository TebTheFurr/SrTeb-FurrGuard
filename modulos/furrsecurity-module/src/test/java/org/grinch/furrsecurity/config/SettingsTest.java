package org.grinch.furrsecurity.config;

import org.grinch.furrguard.common.config.YamlConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SettingsTest {

    @TempDir
    Path dir;

    private Settings load(String yaml) throws IOException {
        Path file = dir.resolve("config.yml");
        Files.writeString(file, yaml);
        YamlConfig.LoadResult result = YamlConfig.load(file);
        assertTrue(result.ok(), result.error());
        return Settings.fromYaml(result.config());
    }

    @Test
    void alertTimesWrittenAsYamlIntegersAreRead() throws IOException {
        // SnakeYAML devuelve Integer: antes daba ClassCastException y las sesiones no caducaban en juego
        Settings settings = load("alert-times:\n  - 60\n  - 3600\n  - 300\n");

        assertEquals(List.of(3600L, 300L, 60L), settings.alertTimes());
    }

    @Test
    void alertTimesAcceptCsvAndSkipInvalidValues() throws IOException {
        assertEquals(List.of(1800L, 30L), load("alert-times: \"30, abc, 1800, 0\"\n").alertTimes());
    }

    @Test
    void defaultsAreTheSafeOnes() throws IOException {
        Settings settings = load("# vacio\n");

        assertTrue(settings.lockMovement() && settings.lockCommands() && settings.lockInventory()
                && settings.lockServerSwitch() && settings.lockChat());
        assertEquals(Settings.DEFAULT_ALERT_TIMES, settings.alertTimes());
        assertEquals("furrsecurity.notify", settings.adminPermission());
        assertEquals(300, settings.earlyVerifySeconds());
    }

    @Test
    void panelSettingsWinAndInvalidValuesKeepTheCurrentOnes() throws IOException {
        Settings settings = load("lock:\n  chat: false\n").withApi(Map.of(
                "furrsecurity_lock_movement", "0",
                "furrsecurity_lock_commands", "maybe",
                "furrsecurity_alert_times", "60,3600,-5,x",
                "furrsecurity_early_verify_time", "120",
                "furrsecurity_admin_permission", "Staff Notify!"));

        assertFalse(settings.lockMovement());
        assertTrue(settings.lockCommands(), "valor invalido: se conserva");
        assertFalse(settings.lockChat(), "el chat solo viene de config.yml");
        assertEquals(List.of(3600L, 60L), settings.alertTimes());
        assertEquals(120, settings.earlyVerifySeconds());
        assertEquals("furrsecurity.notify", settings.adminPermission());
    }

    @Test
    void anEmptyAlertListFromThePanelDisablesAlerts() throws IOException {
        assertEquals(List.of(), load("").withApi(Map.of("furrsecurity_alert_times", "")).alertTimes());
    }
}
