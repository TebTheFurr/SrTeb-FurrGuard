package org.grinch.furrGuard.command;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.text.Component;
import org.grinch.furrGuard.BuildConstants;
import org.grinch.furrGuard.FurrGuard;
import org.grinch.furrGuard.FurrGuard.Readiness;
import org.grinch.furrGuard.FurrGuard.State;
import org.grinch.furrGuard.api.CheckResult;
import org.grinch.furrGuard.api.CheckResult.IpData;
import org.grinch.furrGuard.api.PluginApi;
import org.grinch.furrGuard.api.Reasons;
import org.grinch.furrGuard.config.PluginConfig;
import org.grinch.furrGuard.license.LicenseManager;
import org.grinch.furrGuard.sync.ChangeWatcher.PollStatus;
import org.grinch.furrGuard.util.Players;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrguard.common.text.SafeText;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * /furrguard (/fg, /guard). Nada bloquea el hilo del comando: la API va en futuros y la recarga en el
 * scheduler. Todo valor externo (nick, ISP, errores) se pinta como texto plano.
 */
public final class FurrGuardCommand implements SimpleCommand {

    private static final String PERMISSION = "furrguard.admin";
    private static final Pattern NICK = Pattern.compile("[.*]?[A-Za-z0-9_]{1,16}");
    private static final List<String> SUBCOMMANDS = List.of("check", "status", "reload", "cache", "stats", "help");

    private final FurrGuard plugin;

    public FurrGuardCommand(FurrGuard plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean hasPermission(Invocation invocation) {
        return invocation.source().hasPermission(PERMISSION);
    }

    @Override
    public void execute(Invocation invocation) {
        CommandSource source = invocation.source();
        String[] args = invocation.arguments();
        String subcommand = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);
        switch (subcommand) {
            case "help" -> help(source);
            case "status" -> status(source);
            case "reload" -> reload(source);
            case "check" -> check(source, args);
            case "cache" -> cache(source, args);
            case "stats" -> stats(source);
            default -> error(source, "Subcomando desconocido: {value}. Usa /fg help", subcommand);
        }
    }

    @Override
    public List<String> suggest(Invocation invocation) {
        String[] args = invocation.arguments();
        List<String> options;
        String prefix;
        if (args.length <= 1) {
            options = SUBCOMMANDS;
            prefix = args.length == 0 ? "" : args[0];
        } else if (args.length == 2 && args[0].equalsIgnoreCase("check")) {
            options = plugin.getServer().getAllPlayers().stream().map(Player::getUsername).toList();
            prefix = args[1];
        } else if (args.length == 2 && args[0].equalsIgnoreCase("cache")) {
            options = List.of("clear", "info");
            prefix = args[1];
        } else {
            return List.of();
        }
        String lower = prefix.toLowerCase(Locale.ROOT);
        return options.stream().filter(option -> option.toLowerCase(Locale.ROOT).startsWith(lower)).toList();
    }

    private void help(CommandSource source) {
        LicenseManager license = plugin.license();
        source.sendMessage(Component.empty());
        send(source, " &b&lFurrGuard &7v{version} &8─ &7Sistema de seguridad anti-proxy",
                Map.of("version", BuildConstants.VERSION));
        if (license != null && license.isLicensed()) {
            send(source, "   &a✔ Licencia activa &8─ &7{holder}", Map.of("holder", orUnknown(license.holder())));
        } else {
            send(source, "   &e⚠ Licencia no verificada", Map.of());
        }
        source.sendMessage(Component.empty());
        send(source, " &f&lComandos:", Map.of());
        commandLine(source, "check <jugador>", "Verifica un jugador");
        commandLine(source, "status", "Estado del sistema");
        commandLine(source, "stats", "Estadísticas");
        commandLine(source, "cache <clear|info>", "Caché de verificaciones");
        commandLine(source, "reload", "Recargar config.yml");
        commandLine(source, "help", "Esta ayuda");
        source.sendMessage(Component.empty());
        send(source, " &8─ Gestiona la whitelist y la blacklist desde el panel web", Map.of());
    }

    private void status(CommandSource source) {
        State state = plugin.state();
        PluginConfig config = state.config();
        source.sendMessage(Component.empty());
        send(source, " &f&lEstado del sistema", Map.of());
        String[] readiness = readinessText(state.readiness());
        field(source, "Plugin", readiness[0], readiness[1]);
        String[] license = licenseText(plugin.license());
        field(source, "Licencia", license[0], license[1]);
        PollStatus poll = plugin.watcher().lastPoll();
        if (poll == null) {
            field(source, "API", "&7", "sin datos todavía");
        } else {
            long seconds = Math.max(0, (System.currentTimeMillis() - poll.atMillis()) / 1000);
            field(source, "API", poll.ok() ? "&a" : "&c",
                    (poll.ok() ? "✔ Conectada" : "✘ " + poll.detail()) + " (hace " + seconds + " s)");
        }
        if (config != null) {
            field(source, "Política de fallo", "&f", config.failurePolicy().name().toLowerCase(Locale.ROOT));
            field(source, "Caché", config.cacheEnabled() ? "&a" : "&e", config.cacheEnabled()
                    ? "✔ Habilitada (" + plugin.cache().size() + " entradas, " + config.cacheDuration().toSeconds() + " s)"
                    : "⚠ Deshabilitada");
            field(source, "Debug", config.debug() ? "&e" : "&a", config.debug() ? "⚠ Activado" : "✔ Desactivado");
        }
        field(source, "Jugadores", "&f", String.valueOf(plugin.getServer().getPlayerCount()));
        source.sendMessage(Component.empty());
    }

    private void reload(CommandSource source) {
        info(source, "Recargando config.yml...");
        plugin.getServer().getScheduler().buildTask(plugin, () -> {
            List<String> problems = plugin.reload();
            if (problems.isEmpty()) {
                ok(source, "Configuración recargada. Mensajes y ajustes del panel se recargan en unos segundos.");
            } else {
                error(source, "config.yml no es válida; se mantiene la anterior:", "");
                problems.forEach(problem -> send(source, "   &c- &7{value}", Map.of("value", problem)));
            }
        }).schedule();
    }

    private void check(CommandSource source, String[] args) {
        if (args.length < 2) {
            error(source, "Uso: /fg check <jugador>", "");
            return;
        }
        State state = plugin.state();
        if (state.readiness() != Readiness.READY) {
            error(source, "FurrGuard no está listo: {value}", readinessText(state.readiness())[1]);
            return;
        }
        String name = args[1];
        if (!NICK.matcher(name).matches()) {
            error(source, "Nick no válido: {value}", name);
            return;
        }
        Optional<Player> online = plugin.getServer().getPlayer(name);
        if (online.isPresent()) {
            checkOnline(source, state.api(), online.get());
        } else {
            checkOffline(source, state.api(), name);
        }
    }

    /** recheck_players no registra conexiones ni cuenta intentos: consultar no deja rastro (§1.3). */
    private void checkOnline(CommandSource source, PluginApi api, Player player) {
        String ip = Players.ip(player.getRemoteAddress());
        info(source, "Verificando {value} (conectado)...", player.getUsername());
        JsonObject entry = new JsonObject();
        entry.addProperty("uuid", player.getUniqueId().toString());
        entry.addProperty("nick", player.getUsername());
        entry.addProperty("ip", ip);
        JsonArray players = new JsonArray();
        players.add(entry);
        api.recheckPlayers(players).thenAccept(result -> {
            CheckResult atLogin = plugin.listener().sessionCheck(player);
            source.sendMessage(Component.empty());
            send(source, " &7Verificación: &f&l{name} &8(conectado)", Map.of("name", player.getUsername()));
            field(source, "Servidor", "&b",
                    player.getCurrentServer().map(server -> server.getServerInfo().getName()).orElse("ninguno"));
            field(source, "UUID", "&f", player.getUniqueId().toString());
            field(source, "IP", "&f", ip);
            ipFields(source, atLogin == null ? IpData.EMPTY : atLogin.ipData());
            if (result instanceof ApiResult.Failure failure) {
                field(source, "Estado", "&c", "✘ Error de la API: " + failure.kind() + " " + failure.message());
            } else {
                decisionFields(source, findResult(((ApiResult.Success) result).body(), player));
            }
            source.sendMessage(Component.empty());
        });
    }

    private void checkOffline(CommandSource source, PluginApi api, String name) {
        info(source, "Buscando {value} (desconectado)...", name);
        api.lookupPlayer(name).thenAccept(result -> {
            if (result instanceof ApiResult.Failure failure) {
                error(source, "Error de la API: {value}", failure.kind() + " " + failure.message());
                return;
            }
            JsonObject body = ((ApiResult.Success) result).body();
            if (!Json.bool(body, "found", false)) {
                error(source, "Jugador no encontrado: debe haber entrado al menos una vez.", "");
                return;
            }
            Optional<CheckResult> decision = CheckResult.parse(body);
            source.sendMessage(Component.empty());
            send(source, " &7Verificación: &f&l{name} &8(desconectado)", Map.of("name", Json.str(body, "nick", name)));
            field(source, "UUID", "&f", Json.str(body, "uuid", "Desconocido"));
            field(source, "IP", "&f", Json.str(body, "ip", "Desconocida"));
            field(source, "Última conexión", "&f", Json.str(body, "last_seen", "Desconocida") + " UTC");
            ipFields(source, IpData.parse(Json.obj(body, "ip_data")));
            decisionFields(source, decision);
            source.sendMessage(Component.empty());
        });
    }

    private void cache(CommandSource source, String[] args) {
        String action = args.length < 2 ? "" : args[1].toLowerCase(Locale.ROOT);
        PluginConfig config = plugin.state().config();
        switch (action) {
            case "clear" -> {
                int entries = plugin.cache().size();
                plugin.cache().clear();
                ok(source, "Caché limpiada (" + entries + " entradas).");
            }
            case "info" -> info(source, config == null || !config.cacheEnabled()
                    ? "La caché está deshabilitada."
                    : "Caché habilitada: " + plugin.cache().size() + " entradas, duración "
                    + config.cacheDuration().toSeconds() + " s. Solo guarda respuestas correctas.", "");
            default -> error(source, "Uso: /fg cache <clear|info>", "");
        }
    }

    private void stats(CommandSource source) {
        LicenseManager license = plugin.license();
        source.sendMessage(Component.empty());
        send(source, " &f&lEstadísticas", Map.of());
        field(source, "Jugadores", "&f", plugin.getServer().getPlayerCount() + "/"
                + plugin.getServer().getConfiguration().getShowMaxPlayers());
        field(source, "Servidores", "&f", String.valueOf(plugin.getServer().getAllServers().size()));
        if (license != null && license.isLicensed()) {
            field(source, "Licencia", "&b", license.role() == null ? "Estándar" : license.role());
        }
        source.sendMessage(Component.empty());
    }

    private static Optional<CheckResult> findResult(JsonObject body, Player player) {
        String uuid = player.getUniqueId().toString();
        for (JsonElement element : Json.arr(body, "results")) {
            if (element.isJsonObject() && uuid.equalsIgnoreCase(Json.str(element.getAsJsonObject(), "uuid", ""))) {
                return CheckResult.parse(element.getAsJsonObject());
            }
        }
        return Optional.empty();
    }

    private static void ipFields(CommandSource source, IpData data) {
        if (data.isEmpty()) {
            field(source, "Datos de IP", "&7", "sin datos");
            return;
        }
        field(source, "País", "&f", data.country() == null ? "Desconocido"
                : data.country() + (data.countryCode() == null ? "" : " (" + data.countryCode() + ")"));
        field(source, "ISP", "&f", data.isp() != null ? data.isp() : data.org() != null ? data.org() : "Desconocido");
        field(source, "Proxy", data.proxy() ? "&c" : "&a", data.proxy() ? "⚠ Sí" : "✔ No");
        field(source, "Hosting", data.hosting() ? "&c" : "&a", data.hosting() ? "⚠ Sí" : "✔ No");
        field(source, "Móvil", data.mobile() ? "&e" : "&a", data.mobile() ? "⚠ Sí" : "✔ No");
    }

    /** Un error o una respuesta sin decision nunca se muestra como PERMITIDO. */
    private static void decisionFields(CommandSource source, Optional<CheckResult> decision) {
        if (decision.isEmpty()) {
            field(source, "Estado", "&c", "✘ La API no devolvió una decisión");
            return;
        }
        CheckResult result = decision.get();
        field(source, "Estado", result.allowed() ? "&a&l" : "&c&l", result.allowed() ? "✔ PERMITIDO" : "✘ BLOQUEADO");
        field(source, "Motivo", "&e", Reasons.label(result.reason()));
        if (result.blockReason() != null) {
            field(source, "Razón del baneo", "&f", result.blockReason());
        }
        if (result.banId() != null) {
            field(source, "ID de baneo", "&f", result.banId()
                    + (result.blockType() == null ? "" : " (por " + result.blockType() + ")"));
        }
        if (!result.allowed() && result.banId() != null) {
            field(source, "Expira", "&f", result.expiresAt() == null ? "nunca" : result.expiresAt() + " UTC");
        }
    }

    private static String[] readinessText(Readiness readiness) {
        return switch (readiness) {
            case READY -> new String[]{"&a", "✔ Activo"};
            case STARTING -> new String[]{"&e", "⚠ Iniciando (verificando la licencia)"};
            case UNLICENSED -> new String[]{"&c", "✘ Sin licencia: se deniegan los logins"};
            case CONFIG_ERROR -> new String[]{"&c", "✘ config.yml no válida: se deniegan los logins"};
            case DISABLED -> new String[]{"&e", "⚠ Desactivado (enabled: false): no se comprueba nada"};
        };
    }

    private static String[] licenseText(LicenseManager license) {
        if (license == null) {
            return new String[]{"&e", "⚠ Verificando"};
        }
        return switch (license.status()) {
            case VALID -> new String[]{"&a", "✔ Válida (" + orUnknown(license.holder()) + ")"};
            case GRACE -> new String[]{"&e", "⚠ Periodo de gracia: el servidor de licencias no responde"};
            case PENDING -> new String[]{"&e", "⚠ Verificando"};
            case UNLICENSED -> new String[]{"&c", "✘ Sin vincular (instrucciones en la consola)"};
        };
    }

    private static void commandLine(CommandSource source, String command, String description) {
        send(source, "   &b/fg {command} &8─ &7{description}", Map.of("command", command, "description", description));
    }

    private static void field(CommandSource source, String label, String color, String value) {
        send(source, "   &7{label}: " + color + "{value}", Map.of("label", label, "value", value));
    }

    private static void ok(CommandSource source, String text) {
        send(source, " &a✔ &7{value}", Map.of("value", text));
    }

    private static void info(CommandSource source, String template, String value) {
        send(source, " &7➤ " + template, Map.of("value", value));
    }

    private static void info(CommandSource source, String text) {
        info(source, "{value}", text);
    }

    private static void error(CommandSource source, String template, String value) {
        send(source, " &c✘ &7" + template, Map.of("value", value));
    }

    private static void send(CommandSource source, String template, Map<String, String> values) {
        source.sendMessage(SafeText.render(template, values));
    }

    private static String orUnknown(String value) {
        return value == null ? "Desconocido" : value;
    }
}
