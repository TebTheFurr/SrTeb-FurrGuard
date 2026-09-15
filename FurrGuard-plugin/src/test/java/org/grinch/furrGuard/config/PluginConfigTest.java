package org.grinch.furrGuard.config;

import org.grinch.furrGuard.config.PluginConfig.FailurePolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PluginConfigTest {

    private static final String VALID = """
            api:
              url: "https://furrguard.example.org/api/plugin.php"
              key: "fg_0123456789abcdef"
            """;

    @TempDir
    Path dir;

    private PluginConfig.Loaded load(String yaml) throws IOException {
        Path file = dir.resolve("config.yml");
        Files.writeString(file, yaml);
        return PluginConfig.load(file, getClass().getClassLoader());
    }

    @Test
    void validConfigUsesSafeDefaults() throws IOException {
        PluginConfig.Loaded loaded = load(VALID);

        assertTrue(loaded.ok(), () -> String.valueOf(loaded.problems()));
        PluginConfig config = loaded.config();
        assertTrue(config.enabled());
        assertEquals(FailurePolicy.DENY, config.failurePolicy());
        assertEquals(Duration.ofSeconds(5), config.pollInterval());
        assertEquals(Duration.ofMillis(8000), config.api().requestTimeout());
        assertTrue(config.hispanicCountries().contains("ES"));
        assertEquals("discord.gg/srteb", config.licenseDiscordUrl());
    }

    @Test
    void brokenYamlIsReportedInsteadOfThrowing() throws IOException {
        PluginConfig.Loaded loaded = load("api:\n  url: [unclosed\n  key: x");

        assertFalse(loaded.ok());
        assertNull(loaded.config());
    }

    @Test
    void shippedDefaultsAreRejectedUntilConfigured() {
        PluginConfig.Loaded loaded = PluginConfig.load(dir.resolve("config.yml"), getClass().getClassLoader());

        assertTrue(Files.exists(dir.resolve("config.yml")));
        assertFalse(loaded.ok());
        assertTrue(loaded.problems().stream().anyMatch(problem -> problem.contains("valor de ejemplo")));
    }

    @Test
    void plainHttpNeedsExplicitOptIn() throws IOException {
        String http = VALID.replace("https://", "http://");

        assertFalse(load(http).ok());
        assertTrue(load(http + "  allow-insecure-http: true\n").ok());
    }

    @Test
    void timeoutsMustBePositiveAndBounded() throws IOException {
        assertFalse(load(VALID + "  timeout: 0\n").ok());
        assertFalse(load(VALID + "  connect-timeout: -1\n").ok());
        assertFalse(load(VALID + "  timeout: 30000\n").ok());
    }

    @Test
    void failurePolicyIsValidatedNotGuessed() throws IOException {
        assertEquals(FailurePolicy.ALLOW, load(VALID + "  failure-policy: ALLOW\n").config().failurePolicy());
        assertFalse(load(VALID + "  failure-policy: open\n").ok());
    }

    @Test
    void pollIntervalAndCountriesAreValidated() throws IOException {
        assertFalse(load(VALID + "  poll-interval: 0\n").ok());
        assertFalse(load(VALID + "notifications:\n  hispanic-countries: [ES, Spain]\n").ok());
    }

    @Test
    void disabledPluginDoesNotNeedApiCredentials() throws IOException {
        PluginConfig.Loaded loaded = load("enabled: false\n");

        assertTrue(loaded.ok(), () -> String.valueOf(loaded.problems()));
        assertFalse(loaded.config().enabled());
    }

    @Test
    void legacyBypassKeyIsIgnored() throws IOException {
        assertTrue(load(VALID + "bypass:\n  permission: furrguard.bypass\n").ok());
    }
}
