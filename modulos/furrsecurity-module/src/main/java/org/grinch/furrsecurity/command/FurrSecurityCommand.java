package org.grinch.furrsecurity.command;

import net.kyori.adventure.text.Component;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrguard.common.http.ApiResult.Success;
import org.grinch.furrguard.common.json.Json;
import org.grinch.furrguard.common.text.SafeText;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.api.Replies;
import org.grinch.furrsecurity.manager.VerificationManager.Status;
import org.grinch.furrsecurity.platform.PlatformHandler.PlayerInfo;
import org.grinch.furrsecurity.util.Messages;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiConsumer;

/** {@code /furrsecurity} (alias {@code fsec}, {@code fs}), comun a Velocity y Paper. */
public final class FurrSecurityCommand {

    public static final String ADMIN_PERMISSION = "furrsecurity.admin";
    private static final List<String> SUBCOMMANDS = List.of("reload", "status", "check", "reset", "help");

    public interface Sender {
        void sendMessage(Component message);

        boolean hasPermission(String permission);
    }

    private final FurrSecurity core;

    public FurrSecurityCommand(FurrSecurity core) {
        this.core = core;
    }

    public void execute(Sender sender, String[] args) {
        if (!sender.hasPermission(ADMIN_PERMISSION)) {
            sender.sendMessage(core.messages().prefixed("no_permission"));
            return;
        }
        switch (args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT)) {
            case "reload" -> reload(sender);
            case "status", "stats" -> status(sender);
            case "check" -> withTarget(sender, args, this::check);
            case "reset" -> withTarget(sender, args, this::reset);
            default -> help(sender);
        }
    }

    public List<String> suggest(String[] args) {
        if (args.length <= 1) {
            return startingWith(SUBCOMMANDS, args.length == 0 ? "" : args[0]);
        }
        if (args.length == 2 && List.of("check", "reset").contains(args[0].toLowerCase(Locale.ROOT))) {
            return startingWith(core.platform().onlinePlayers().stream().map(PlayerInfo::nick).toList(), args[1]);
        }
        return List.of();
    }

    private void help(Sender sender) {
        sender.sendMessage(core.messages().get("stats_header"));
        for (String line : List.of("&c/fsec reload &7- Recarga config.yml, la API, ajustes y mensajes",
                "&c/fsec status &7- Estado del modulo",
                "&c/fsec check <jugador> &7- Estado de verificacion de un jugador",
                "&c/fsec reset <jugador> &7- Invalida su sesion y le obliga a verificar de nuevo")) {
            sender.sendMessage(SafeText.render(line));
        }
    }

    private void reload(Sender sender) {
        List<String> problems = core.reload();
        if (problems.isEmpty()) {
            sender.sendMessage(core.messages().prefixed("reload_success"));
            return;
        }
        for (String problem : problems) {
            sender.sendMessage(SafeText.render("&c{problem}", Map.of("problem", problem)));
        }
    }

    private void status(Sender sender) {
        Boolean sync = core.isSyncHealthy();
        String api = !core.apiProblems().isEmpty() ? core.apiProblems().get(0)
                : sync == null ? "esperando respuesta" : sync ? "OK" : "sin respuesta (se reintenta cada minuto)";
        sender.sendMessage(core.messages().get("stats_header"));
        line(sender, "Activo", core.isEnabled() ? "si" : "no (config.yml)");
        line(sender, "Plataforma", core.platform().name() + (core.isProxyMode() ? " (modo proxy)" : ""));
        line(sender, "API", api);
        line(sender, "Staff en la lista", String.valueOf(core.listedStaffCount()));
        line(sender, "Jugadores bloqueados", String.valueOf(core.verifier().lockedPlayers().size()));
    }

    private void check(Sender sender, PlayerInfo target) {
        Optional<Status> status = core.verifier().status(target.uuid());
        sender.sendMessage(core.messages().get("stats_header"));
        line(sender, "Jugador", target.nick());
        line(sender, "Estado", core.verifier().isLocked(target.uuid()) ? "bloqueado"
                : status.map(FurrSecurityCommand::label).orElse("sin comprobar"));
        long seconds = core.verifier().sessionSeconds(target.uuid());
        if (seconds >= 0) {
            line(sender, "Sesion", Messages.formatTime(seconds));
        }
    }

    /** Nunca desbloquea: el jugador queda bloqueado al momento y debe verificar de nuevo. */
    private void reset(Sender sender, PlayerInfo target) {
        sender.sendMessage(SafeText.render("&7Reseteando la sesion de &f{player}&7: queda bloqueado hasta verificar.",
                Map.of("player", target.nick())));
        core.verifier().reset(target, result -> sender.sendMessage(resetReply(target.nick(), result)));
    }

    private static Component resetReply(String nick, ApiResult result) {
        if (result instanceof Success ok && Json.bool(ok.body(), "success", false)) {
            return SafeText.render("&aSesion de &f{player} &areseteada ({count} expiradas). Debe verificar de nuevo.",
                    Map.of("player", nick, "count", String.valueOf(Json.integer(ok.body(), "sessions_expired", 0))));
        }
        return SafeText.render("&cNo se pudo resetear la sesion de &f{player} &c({error}): sigue bloqueado y se reintenta.",
                Map.of("player", nick, "error", Replies.describe(result)));
    }

    private void withTarget(Sender sender, String[] args, BiConsumer<Sender, PlayerInfo> action) {
        if (args.length < 2) {
            sender.sendMessage(SafeText.render("&cUso: /fsec {sub} <jugador>", Map.of("sub", args[0])));
            return;
        }
        Optional<PlayerInfo> target = core.platform().findPlayer(args[1]);
        if (target.isEmpty()) {
            sender.sendMessage(core.messages().prefixed("player_not_found"));
            return;
        }
        action.accept(sender, target.get());
    }

    private void line(Sender sender, String key, String value) {
        sender.sendMessage(core.messages().get("stats_line", "key", key, "value", value));
    }

    private static String label(Status status) {
        return switch (status) {
            case LOCKED -> "bloqueado";
            case VERIFIED -> "verificado";
            case EXEMPT -> "exento (modulo desactivado en el panel)";
            case NOT_STAFF -> "no es staff";
            case UNCHECKED -> "sin comprobar";
        };
    }

    private static List<String> startingWith(List<String> options, String prefix) {
        String lower = prefix.toLowerCase(Locale.ROOT);
        return options.stream().filter(option -> option.toLowerCase(Locale.ROOT).startsWith(lower)).toList();
    }
}
