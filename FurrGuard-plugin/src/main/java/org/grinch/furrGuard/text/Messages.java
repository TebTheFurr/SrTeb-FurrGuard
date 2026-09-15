package org.grinch.furrGuard.text;

import net.kyori.adventure.text.Component;
import org.grinch.furrguard.common.text.SafeText;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Map;

/**
 * Plantillas de mensajes: las del panel ({@code get_messages}) mandan sobre las de {@code messages.yml}.
 * Se pintan siempre con {@link SafeText}: los valores (nick, ISP, pais, motivo...) nunca cambian colores.
 * Guarda tambien los ajustes de {@code get_settings}.
 */
public final class Messages {

    public static final String RESOURCE = "messages.yml";
    private static final DateTimeFormatter API_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final Map<String, String> defaults;
    private volatile Map<String, String> fromApi = Map.of();
    private volatile Map<String, String> settings = Map.of();

    public Messages(Map<String, String> defaults) {
        this.defaults = Map.copyOf(defaults);
    }

    public static Messages fromResource(ClassLoader loader) {
        try (InputStream in = loader.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("falta el recurso " + RESOURCE);
            }
            Object root = new Yaml(new SafeConstructor(new LoaderOptions())).load(in);
            if (!(root instanceof Map<?, ?> map)) {
                throw new IllegalStateException(RESOURCE + " no es un mapa clave: valor");
            }
            Map<String, String> values = new HashMap<>();
            map.forEach((key, value) -> {
                if (key != null && value != null) {
                    values.put(String.valueOf(key), String.valueOf(value));
                }
            });
            return new Messages(values);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void updateMessages(Map<String, String> messages) {
        fromApi = Map.copyOf(messages);
    }

    public void updateSettings(Map<String, String> values) {
        settings = Map.copyOf(values);
    }

    public int apiMessageCount() {
        return fromApi.size();
    }

    /** Plantilla cruda (codigos {@code &} incluidos); la propia clave si no existe. */
    public String template(String key) {
        String value = fromApi.get(key);
        if (value == null || value.isBlank()) {
            value = defaults.get(key);
        }
        return value == null ? key : value;
    }

    public String setting(String key, String def) {
        String value = settings.get(key);
        return value == null || value.isBlank() ? def : value;
    }

    public boolean settingEnabled(String key) {
        String value = settings.get(key);
        return value != null && (value.trim().equals("1") || value.trim().equalsIgnoreCase("true"));
    }

    public Component render(String key, Map<String, String> values) {
        return renderTemplate(template(key), values);
    }

    /** Con el prefijo del panel delante. */
    public Component prefixed(String key, Map<String, String> values) {
        return prefixedTemplate(template(key), values);
    }

    public Component prefixedTemplate(String template, Map<String, String> values) {
        return renderTemplate(template("prefix") + template, values);
    }

    /** {server_name} y {discord} salen de get_settings; {@code values} puede sobrescribirlos. */
    public Component renderTemplate(String template, Map<String, String> values) {
        Map<String, String> all = new HashMap<>();
        all.put("server_name", setting("server_name", "FurrGuard"));
        all.put("discord", setting("discord_url", ""));
        all.putAll(values);
        return SafeText.render(template, all);
    }

    /**
     * Valor de {@code {time_remaining}} (se pega a "suspendida"): " permanentemente" o
     * " temporalmente (2d 3h 15m)". {@code expiresAt} es UTC {@code yyyy-MM-dd HH:mm:ss} (§0).
     */
    public static String timeRemaining(String expiresAt, Instant now) {
        if (expiresAt == null || expiresAt.isBlank()) {
            return " permanentemente";
        }
        Instant end;
        try {
            end = LocalDateTime.parse(expiresAt.trim(), API_TIME).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            return " temporalmente";
        }
        Duration left = Duration.between(now, end);
        if (left.isNegative() || left.isZero()) {
            return " temporalmente";
        }
        left = left.plusSeconds(59); // redondea al minuto siguiente: 30 s → 1m
        long days = left.toDays();
        StringBuilder text = new StringBuilder(" temporalmente (");
        if (days > 0) {
            text.append(days).append("d ");
        }
        if (days > 0 || left.toHoursPart() > 0) {
            text.append(left.toHoursPart()).append("h ");
        }
        return text.append(left.toMinutesPart()).append("m)").toString();
    }
}
