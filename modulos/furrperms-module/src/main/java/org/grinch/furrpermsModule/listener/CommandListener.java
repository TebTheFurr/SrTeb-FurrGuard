package org.grinch.furrpermsModule.listener;

import com.velocitypowered.api.event.EventTask;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.event.command.CommandExecuteEvent.CommandResult;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import org.grinch.furrguard.common.command.CommandNormalizer;
import org.grinch.furrguard.common.http.ApiResult;
import org.grinch.furrpermsModule.access.AccessDecision;
import org.grinch.furrpermsModule.access.AccessGate;
import org.grinch.furrpermsModule.config.Config;
import org.grinch.furrpermsModule.util.MessageUtil;
import org.slf4j.Logger;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Comandos protegidos: se deciden de forma asincrona ({@link EventTask}) sin bloquear el hilo del evento.
 * El comando queda denegado mientras se decide, asi un error nunca lo deja pasar.
 */
public final class CommandListener {

    public static final String NOTIFY_PERMISSION = "furrperms.notify";
    private static final int MAX_LOGGED_COMMAND = 255;

    /** Lo que se usa de {@code api/plugin.php}; en produccion, el {@code ApiClient} comun. */
    public interface Api {
        CompletableFuture<ApiResult> post(String action, Map<String, String> form);

        CompletableFuture<ApiResult> postOnce(String action, Map<String, String> form);
    }

    private final Config config;
    private final Api api;
    private final MessageUtil messages;
    private final ProxyServer server;
    private final Logger logger;
    private final AccessGate gate = new AccessGate(System::currentTimeMillis);

    public CommandListener(Config config, Api api, MessageUtil messages, ProxyServer server, Logger logger) {
        this.config = config;
        this.api = api;
        this.messages = messages;
        this.server = server;
        this.logger = logger;
    }

    /** El ultimo: decide sobre el comando que de verdad se va a ejecutar, aunque otro plugin lo haya cambiado. */
    @Subscribe(priority = Short.MIN_VALUE)
    public EventTask onCommand(CommandExecuteEvent event) {
        CommandResult original = event.getResult();
        if (!(event.getCommandSource() instanceof Player player) || !original.isAllowed()) {
            return null;
        }
        String command = original.getCommand().orElse(event.getCommand());
        if (!config.isProtected(command)) {
            return null;
        }
        event.setResult(CommandResult.denied());

        String nick = player.getUsername();
        String ip = ip(player.getRemoteAddress());
        AccessDecision local = gate.cached(nick, player.getUniqueId(), ip);
        if (local != null) {
            apply(event, original, player, command, local, local != AccessDecision.COOLDOWN);
            return null;
        }
        CompletableFuture<Void> decision = api
                .post("check_furr_perms_whitelist", Map.of("nick", nick, "uuid", player.getUniqueId().toString(), "ip", ip))
                .thenAccept(result -> {
                    AccessDecision fresh = AccessDecision.from(result);
                    gate.remember(nick, player.getUniqueId(), ip, fresh);
                    apply(event, original, player, command, fresh, true);
                })
                .exceptionally(error -> {
                    logger.error("Error decidiendo un comando protegido de " + nick + " (queda denegado)", error);
                    return null;
                });
        return EventTask.resumeWhenComplete(decision);
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        gate.forget(event.getPlayer().getUsername(), event.getPlayer().getUniqueId());
    }

    private void apply(CommandExecuteEvent event, CommandResult original, Player player, String command,
                       AccessDecision decision, boolean report) {
        String shown = "/" + command;
        if (decision.allowed()) {
            event.setResult(original);
        } else {
            player.sendMessage(messages.render(decision.messageKey(), Map.of("command", shown)));
        }
        if (config.debug()) { // nunca los argumentos: podrian ser secretos
            logger.info("[DEBUG] " + player.getUsername() + " " + labels(command)
                    + " -> " + (decision.allowed() ? "permitido" : "denegado") + " (" + decision.reason() + ")");
        }
        if (report && !decision.moduleDisabled()) {
            report(player, shown, decision);
        }
    }

    private void report(Player player, String command, AccessDecision decision) {
        String server = player.getCurrentServer().map(connection -> connection.getServerInfo().getName()).orElse("proxy");
        String logged = command.length() > MAX_LOGGED_COMMAND ? command.substring(0, MAX_LOGGED_COMMAND) : command;
        api.postOnce("log_furr_perms_command", Map.of(
                "player_uuid", player.getUniqueId().toString(),
                "player_nick", player.getUsername(),
                "command", logged,
                "server_name", server,
                "allowed", decision.allowed() ? "1" : "0",
                "reason", decision.reason(),
                "ip_address", ip(player.getRemoteAddress())));

        if (decision.allowed() ? config.notifyAllowed() : config.notifyBlocked()) {
            logger.info("[FurrPerms] " + player.getUsername() + " " + labels(command) + " en " + server + ": "
                    + (decision.allowed() ? "permitido" : "denegado (" + decision.reason() + ")"));
            Component notification = messages.notification(
                    decision.allowed() ? "fur_perms_notify_allowed" : "fur_perms_notify_blocked",
                    Map.of("player", player.getUsername(), "command", logged, "server", server, "reason", decision.reason()));
            this.server.getAllPlayers().stream()
                    .filter(admin -> admin.hasPermission(NOTIFY_PERMISSION))
                    .forEach(admin -> admin.sendMessage(notification));
        }
    }

    /** Solo las etiquetas raiz ({@code /lp}), sin argumentos. */
    private static String labels(String command) {
        return "/" + String.join(" /", CommandNormalizer.rootLabels(command));
    }

    private static String ip(InetSocketAddress address) {
        if (address == null || address.getAddress() == null) {
            return "";
        }
        String host = address.getAddress().getHostAddress();
        int scope = host.indexOf('%');
        return scope < 0 ? host : host.substring(0, scope);
    }
}
