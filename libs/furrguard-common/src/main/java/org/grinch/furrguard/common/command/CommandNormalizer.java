package org.grinch.furrguard.common.command;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Averigua que comandos se ejecutarian realmente a partir del texto que escribe un jugador, para
 * que los alias, namespaces y envoltorios no esquiven una lista de comandos protegidos.
 *
 * <ul>
 *   <li>{@code /luckperms:lp user X permission set *} → {@code [lp]}</li>
 *   <li>{@code /minecraft:execute as @a run lp ...} → {@code [execute, lp]}</li>
 *   <li>{@code /sudo Bob op Bob} → {@code [sudo, op]}</li>
 * </ul>
 *
 * <p>Ante la duda es conservador: prefiere un falso positivo (bloquear de mas) a dejar pasar un
 * comando protegido. Por ejemplo, cada {@code run} tras {@code execute} se trata como posible
 * inicio de un subcomando, porque {@code run} tambien puede ser un nombre de jugador.
 */
public final class CommandNormalizer {

    /**
     * Etiquetas conocidas de LuckPerms (Bukkit, Bungee, Velocity), permisos vanilla y PermissionsEx.
     * Es una referencia: la lista protegida definitiva la decide cada modulo.
     */
    public static final Set<String> KNOWN_PERMISSION_LABELS = Set.of(
            // LuckPerms en servidor
            "lp", "luckperms", "perm", "perms", "permission", "permissions",
            // LuckPerms en BungeeCord
            "lpb", "luckpermsbungee", "bperm", "bperms", "bpermission", "bpermissions",
            // LuckPerms en Velocity
            "lpv", "luckpermsvelocity", "luckpermsv", "vperm", "vperms", "vpermission", "vpermissions",
            // vanilla
            "op", "deop",
            // PermissionsEx
            "pex", "permissionsex"
    );

    /** Envoltorios "ejecutar como otro": etiqueta → argumentos que preceden al comando envuelto. */
    private static final Map<String, Integer> RUN_AS_WRAPPERS = Map.of(
            "sudo", 1,   // EssentialsX / CMI: sudo <jugador> <comando>
            "esudo", 1
    );

    private CommandNormalizer() {
    }

    /** Etiquetas raiz (minusculas, sin {@code /} ni namespace) que ejecutaria el comando, en orden. */
    public static List<String> rootLabels(String rawCommand) {
        if (rawCommand == null) {
            return List.of();
        }
        String[] tokens = rawCommand.strip().toLowerCase(Locale.ROOT).split("\\s+");
        // commandStart[i]: el trozo i puede ser el inicio de un comando que se ejecuta.
        // Los saltos solo van hacia delante, asi que basta una pasada (lineal, sin recursion).
        boolean[] commandStart = new boolean[tokens.length + 3];
        commandStart[0] = true;
        boolean executeSeen = false;
        Set<String> labels = new LinkedHashSet<>();
        for (int i = 0; i < tokens.length; i++) {
            if (executeSeen && tokens[i].equals("run")) {
                commandStart[i + 1] = true; // cualquier "run" posterior a un execute
            }
            if (!commandStart[i]) {
                continue;
            }
            String label = label(tokens[i]);
            if (label.isEmpty()) {
                commandStart[i + 1] = true; // "/ lp": el trozo vacio no es el comando
                continue;
            }
            labels.add(label);
            if (label.equals("execute")) {
                executeSeen = true;
            } else if (RUN_AS_WRAPPERS.containsKey(label)) {
                commandStart[Math.min(i + 1 + RUN_AS_WRAPPERS.get(label), tokens.length)] = true;
            } else if (label.equals("cmi") && i + 1 < tokens.length && label(tokens[i + 1]).equals("sudo")) {
                commandStart[i + 3] = true; // cmi sudo <jugador> <comando>
            }
        }
        return List.copyOf(labels);
    }

    /**
     * {@code true} si alguna etiqueta que se ejecutaria esta en {@code protectedLabels}. Las entradas
     * protegidas se normalizan igual ({@code minecraft:op} → {@code op}); si contienen espacios solo
     * cuenta la primera palabra ({@code "lp user"} protege todo {@code lp}: nunca menos restrictivo).
     */
    public static boolean matchesAny(String rawCommand, Set<String> protectedLabels) {
        if (protectedLabels == null || protectedLabels.isEmpty()) {
            return false;
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String entry : protectedLabels) {
            List<String> entryLabels = entry == null ? List.of() : rootLabels(entry);
            if (!entryLabels.isEmpty()) {
                normalized.add(entryLabels.get(0));
            }
        }
        for (String label : rootLabels(rawCommand)) {
            if (normalized.contains(label)) {
                return true;
            }
        }
        return false;
    }

    /** Quita las {@code /} iniciales y el namespace ({@code luckperms:lp} → {@code lp}). */
    private static String label(String token) {
        int begin = 0;
        while (begin < token.length() && token.charAt(begin) == '/') {
            begin++;
        }
        String label = token.substring(begin);
        int colon = label.lastIndexOf(':');
        if (colon < 0) {
            return label;
        }
        String afterColon = label.substring(colon + 1);
        // "lp:" no es un comando real, pero por prudencia se trata como "lp"
        return afterColon.isEmpty() ? label.substring(0, label.indexOf(':')) : afterColon;
    }
}
