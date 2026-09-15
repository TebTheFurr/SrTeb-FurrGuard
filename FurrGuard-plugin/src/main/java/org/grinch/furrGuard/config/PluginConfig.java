package org.grinch.furrGuard.config;

import org.grinch.furrGuard.BuildConstants;
import org.grinch.furrguard.common.config.YamlConfig;
import org.grinch.furrguard.common.http.ApiClient;
import org.grinch.furrguard.common.http.ApiClientConfig;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** config.yml ya validado. Inmutable: una recarga crea otro. */
public record PluginConfig(
        boolean enabled,
        boolean debug,
        ApiClientConfig api,
        FailurePolicy failurePolicy,
        Duration pollInterval,
        boolean cacheEnabled,
        Duration cacheDuration,
        String licenseDiscordUrl,
        Set<String> hispanicCountries) {

    /** Que hacer con un login cuando la API no da una decision (red, timeout, 5xx, 429, JSON invalido). */
    public enum FailurePolicy { DENY, ALLOW }

    /** {@code config} es null si hay problemas. */
    public record Loaded(PluginConfig config, List<String> problems) {
        public boolean ok() {
            return problems.isEmpty();
        }
    }

    public static final String RESOURCE = "config.yml";
    /** El cliente de Minecraft corta el login a los 30 s: la decision tiene que llegar antes. */
    static final int MAX_TIMEOUT_MILLIS = 25_000;
    private static final String EXAMPLE_HOST = "tu-dominio.com";
    private static final List<String> DEFAULT_HISPANIC = List.of("ES", "MX", "AR", "CO", "PE", "VE", "CL", "EC",
            "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "GQ");

    public static Loaded load(Path file, ClassLoader loader) {
        YamlConfig.LoadResult result = YamlConfig.load(file, loader, RESOURCE);
        return result.ok() ? parse(result.config()) : new Loaded(null, List.of(result.error()));
    }

    static Loaded parse(YamlConfig yaml) {
        List<String> problems = new ArrayList<>();
        boolean enabled = yaml.bool("enabled", true);
        int timeoutMillis = yaml.integer("api.timeout", 8000);
        ApiClientConfig api = ApiClientConfig.builder(yaml.string("api.url", ""), yaml.string("api.key", ""))
                .userAgent("FurrGuard-Velocity/" + BuildConstants.VERSION)
                .requestTimeout(Duration.ofMillis(timeoutMillis))
                .connectTimeout(Duration.ofMillis(yaml.integer("api.connect-timeout", 5000)))
                .allowInsecureHttp(yaml.bool("api.allow-insecure-http", false))
                .build();
        if (enabled) { // desactivado no usa la API: no se exige una URL ni una clave reales
            problems.addAll(ApiClient.validateConfig(api));
            if (api.baseUrl().contains(EXAMPLE_HOST)) {
                problems.add("la URL de la API es el valor de ejemplo (" + EXAMPLE_HOST + ")");
            }
            if (timeoutMillis > MAX_TIMEOUT_MILLIS) {
                problems.add("api.timeout no puede superar " + MAX_TIMEOUT_MILLIS
                        + " ms: el cliente de Minecraft abandonaria el login antes");
            }
        }

        FailurePolicy policy = FailurePolicy.DENY;
        String rawPolicy = yaml.string("api.failure-policy", "deny").trim().toLowerCase(Locale.ROOT);
        if (rawPolicy.equals("allow")) {
            policy = FailurePolicy.ALLOW;
        } else if (!rawPolicy.equals("deny")) {
            problems.add("api.failure-policy debe ser deny o allow (es '" + rawPolicy + "')");
        }

        int pollSeconds = yaml.integer("api.poll-interval", 5);
        if (pollSeconds < 1 || pollSeconds > 300) {
            problems.add("api.poll-interval debe estar entre 1 y 300 segundos");
        }
        int cacheSeconds = yaml.integer("cache.duration", 300);
        if (cacheSeconds < 1) {
            problems.add("cache.duration debe ser mayor que 0");
        }

        Set<String> countries = new LinkedHashSet<>();
        for (String code : yaml.stringList("notifications.hispanic-countries", DEFAULT_HISPANIC)) {
            String normalized = code.trim().toUpperCase(Locale.ROOT);
            if (normalized.matches("[A-Z]{2}")) {
                countries.add(normalized);
            } else {
                problems.add("notifications.hispanic-countries: '" + code + "' no es un codigo de pais de 2 letras");
            }
        }

        PluginConfig config = new PluginConfig(enabled, yaml.bool("debug", false), api, policy,
                Duration.ofSeconds(pollSeconds), yaml.bool("cache.enabled", true), Duration.ofSeconds(cacheSeconds),
                yaml.string("license.discord-url", "discord.gg/srteb"), Set.copyOf(countries));
        return problems.isEmpty() ? new Loaded(config, List.of()) : new Loaded(null, List.copyOf(problems));
    }
}
