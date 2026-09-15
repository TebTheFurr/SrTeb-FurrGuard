package org.grinch.furrguard.common.text;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextReplacementConfig;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mensajes con codigos legacy ({@code &c}, {@code §c}, {@code &#RRGGBB}, {@code &x&R&R&G&G&B&B})
 * donde los <b>valores</b> de los placeholders nunca se interpretan como formato.
 *
 * <p>La plantilla (texto del panel o por defecto) se deserializa entera; cada {@code {clave}} se
 * sustituye despues por {@code Component.text(valor)}, que hereda el estilo activo en ese punto.
 * Un nick, un ISP o un comando con {@code &a} o {@code §c} se ve tal cual y no cambia colores.
 * Ademas, en los valores: {@code §} pasa a {@code &} (el cliente de Minecraft interpreta {@code §}
 * incluso dentro de texto plano), los caracteres de control pasan a espacio (sin lineas falsas) y
 * los de formato invisibles (p. ej. U+202E, que invierte el texto) se eliminan.
 *
 * <p>Fragmentos de confianza que deban conservar sus colores (otro mensaje propio) se sustituyen
 * en la plantilla con {@code String.replace} antes de llamar a {@link #render}.
 */
public final class SafeText {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.builder()
            .character(LegacyComponentSerializer.AMPERSAND_CHAR)
            .hexColors()
            .useUnusualXRepeatedCharacterHexFormat()
            .build();

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([A-Za-z0-9_.-]{1,64})}");
    // Marcadores de uso privado: no son codigos legacy, asi que sobreviven intactos a la deserializacion
    private static final char MARK_START = '';
    private static final char MARK_END = '';
    private static final Pattern MARKER = Pattern.compile(MARK_START + "(\\d{1,4})" + MARK_END);
    private static final Pattern CODES =
            Pattern.compile("(?i)[&§](?:x(?:[&§][0-9a-f]){6}|#[0-9a-f]{6}|[0-9a-fk-orx])");

    private SafeText() {
    }

    /** Plantilla sin placeholders. */
    public static Component render(String template) {
        return render(template, Map.of());
    }

    /**
     * @param template     texto con codigos legacy y {@code {clave}}; las claves sin valor se dejan literales
     * @param placeholders valores no confiables; {@code null} se muestra como cadena vacia
     */
    public static Component render(String template, Map<String, String> placeholders) {
        if (template == null || template.isEmpty()) {
            return Component.empty();
        }
        Map<String, String> source = placeholders == null ? Map.of() : placeholders;
        List<String> values = new ArrayList<>();
        StringBuilder marked = new StringBuilder(template.length() + 16);
        Matcher matcher = PLACEHOLDER.matcher(template);
        while (matcher.find()) {
            String key = matcher.group(1);
            String replacement = matcher.group();
            if (source.containsKey(key)) {
                replacement = String.valueOf(MARK_START) + values.size() + MARK_END;
                values.add(neutralize(source.get(key)));
            }
            matcher.appendReplacement(marked, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(marked);

        Component base = LEGACY.deserialize(marked.toString().replace('§', '&'));
        if (values.isEmpty()) {
            return base;
        }
        // Una sola pasada: el texto insertado no se vuelve a examinar
        return base.replaceText(TextReplacementConfig.builder()
                .match(MARKER)
                .replacement((match, builder) -> {
                    int index = Integer.parseInt(match.group(1));
                    return Component.text(index < values.size() ? values.get(index) : match.group());
                })
                .build());
    }

    /** Quita codigos de color/formato ({@code &} y {@code §}, incluidos hex) para consola o logs. */
    public static String stripCodes(String text) {
        return text == null ? "" : CODES.matcher(text).replaceAll("");
    }

    private static String neutralize(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length());
        value.codePoints().forEach(cp -> {
            if (cp == '§') {
                out.append('&');
            } else if (Character.isISOControl(cp)) {
                out.append(' ');
            } else if (Character.getType(cp) != Character.FORMAT) {
                out.appendCodePoint(cp);
            }
        });
        return out.toString();
    }
}
