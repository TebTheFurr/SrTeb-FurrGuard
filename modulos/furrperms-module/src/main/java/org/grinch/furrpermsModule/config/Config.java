package org.grinch.furrpermsModule.config;

import org.grinch.furrguard.common.command.CommandNormalizer;
import org.grinch.furrguard.common.config.YamlConfig;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * config.yml de FurrPerms.
 *
 * @param protectedLabels lista integrada ({@link CommandNormalizer#KNOWN_PERMISSION_LABELS}) mas las de
 *                        {@code commands.protected}: una configuracion antigua nunca protege menos
 */
public record Config(boolean enabled, boolean debug, String apiUrl, String apiKey, Set<String> protectedLabels,
                     boolean notifyBlocked, boolean notifyAllowed) {

    public static final String DEFAULT_API_URL = "https://furrguard.srteb.eu/api/plugin.php";

    public Config {
        protectedLabels = Set.copyOf(protectedLabels);
    }

    public static Config from(YamlConfig yaml) {
        Set<String> labels = new LinkedHashSet<>(CommandNormalizer.KNOWN_PERMISSION_LABELS);
        labels.addAll(yaml.stringList("commands.protected", List.of())); // lista YAML o el CSV de la 1.x
        return new Config(
                yaml.bool("enabled", true),
                yaml.bool("debug", false),
                yaml.string("api.url", DEFAULT_API_URL),
                yaml.string("api.key", yaml.string("api-key", "")), // api-key: clave de la 1.x
                labels,
                yaml.bool("notifications.blocked", true),
                yaml.bool("notifications.allowed", true));
    }

    public boolean isProtected(String command) {
        return CommandNormalizer.matchesAny(command, protectedLabels);
    }
}
