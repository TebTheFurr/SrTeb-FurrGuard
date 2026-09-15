package org.grinch.furrpermsModule.util;

import net.kyori.adventure.text.Component;
import org.grinch.furrguard.common.text.SafeText;

import java.util.HashMap;
import java.util.Map;

/**
 * Mensajes {@code fur_perms_*}: los del panel ({@code get_messages}) sustituyen a estos por defecto.
 * Los valores (nick, comando, servidor) nunca se interpretan como formato: {@code /op x &a✔ ...} no
 * puede falsificar un aviso de "permitido".
 */
public final class MessageUtil {

    public static final String KEY_PREFIX = "fur_perms_";
    private static final String NOTIFY_PREFIX = "&3[FurrPerms] &r";

    private static final Map<String, String> DEFAULTS = Map.of(
            "fur_perms_no_permission", "&c✘ &cNo tienes permiso para ejecutar este comando. Solo administradores autorizados pueden usar comandos de gestión de permisos.",
            "fur_perms_command_blocked", "&c✘ &cEl comando &f{command} &cestá restringido por FurrPerms. Solo usuarios autorizados pueden ejecutarlo.",
            "fur_perms_uuid_mismatch", "&c✘ &cTu cuenta no coincide con la autorizada para usar &f{command}&c.",
            "fur_perms_needs_furrsecurity", "&c✘ &cVerifica tu identidad con FurrSecurity antes de usar &f{command}&c.",
            "fur_perms_unavailable", "&c✘ &cNo se ha podido comprobar tu autorización. Inténtalo de nuevo en unos segundos.",
            "fur_perms_notify_blocked", "&c⚠ &f{player} &7intentó ejecutar &f{command} &7en servidor &f{server}",
            "fur_perms_notify_allowed", "&a✔ &f{player} &7ejecutó &f{command} &7en servidor &f{server}");

    private volatile Map<String, String> templates = DEFAULTS;

    /** Aplica {@code get_messages} (objeto plano); solo cuentan las claves {@code fur_perms_*}. */
    public void apply(Map<String, String> api) {
        Map<String, String> merged = new HashMap<>(DEFAULTS);
        api.forEach((key, value) -> {
            if (key.startsWith(KEY_PREFIX) && value != null) {
                merged.put(key, value);
            }
        });
        templates = Map.copyOf(merged);
    }

    public Component render(String key, Map<String, String> placeholders) {
        return SafeText.render(template(key), placeholders);
    }

    /** Aviso para administradores, con el prefijo de FurrPerms. */
    public Component notification(String key, Map<String, String> placeholders) {
        return SafeText.render(NOTIFY_PREFIX + template(key), placeholders);
    }

    private String template(String key) {
        return templates.getOrDefault(key, "").replace("\\n", "\n");
    }
}
