package org.grinch.furrsecurity.velocity;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.command.CommandExecuteEvent;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PostLoginEvent;
import com.velocitypowered.api.event.player.ServerPostConnectEvent;
import com.velocitypowered.api.event.player.ServerPreConnectEvent;
import com.velocitypowered.api.proxy.Player;
import org.grinch.furrsecurity.FurrSecurity;

/**
 * Bloqueo en el proxy: comandos (todos, tambien /fsec) y cambio de servidor. Se deniega con la
 * prioridad mas alta y se reafirma con la mas baja, por si otro plugin lo cambia entre medias.
 *
 * <p>El chat no se corta aqui: en Velocity denegar un mensaje expulsa a los clientes 1.19.1+ (ver
 * {@code PlayerChatEvent#setResult}). Lo corta FurrSecurity en Paper. Por lo mismo, un comando con
 * argumentos firmados ({@code /msg}) de un bloqueado acaba en expulsion, que sigue siendo fallar en cerrado.
 */
public final class VelocityListener {

    private static final short FIRST = Short.MAX_VALUE;
    private static final short LAST = Short.MIN_VALUE;

    private final FurrSecurity core;
    private final VelocityHandler handler;

    VelocityListener(FurrSecurity core, VelocityHandler handler) {
        this.core = core;
        this.handler = handler;
    }

    /** Bloquea antes de conectar con ningun servidor y sin HTTP. */
    @Subscribe(priority = FIRST)
    public void onPostLogin(PostLoginEvent event) {
        core.verifier().onJoin(handler.info(event.getPlayer()), false);
    }

    /** Ya en un servidor: ahora puede recibir el enlace. */
    @Subscribe
    public void onServerPostConnect(ServerPostConnectEvent event) {
        core.verifier().onServerReady(event.getPlayer().getUniqueId());
    }

    @Subscribe(priority = LAST)
    public void onDisconnect(DisconnectEvent event) {
        core.verifier().onQuit(event.getPlayer().getUniqueId(), event.getPlayer());
    }

    @Subscribe(priority = FIRST)
    public void onCommandFirst(CommandExecuteEvent event) {
        denyCommand(event, true);
    }

    @Subscribe(priority = LAST)
    public void onCommandLast(CommandExecuteEvent event) {
        denyCommand(event, false);
    }

    @Subscribe(priority = FIRST)
    public void onServerSwitchFirst(ServerPreConnectEvent event) {
        denyServerSwitch(event, true);
    }

    @Subscribe(priority = LAST)
    public void onServerSwitchLast(ServerPreConnectEvent event) {
        denyServerSwitch(event, false);
    }

    private void denyCommand(CommandExecuteEvent event, boolean notify) {
        if (event.getCommandSource() instanceof Player player && core.settings().lockCommands() && isLocked(player)) {
            event.setResult(CommandExecuteEvent.CommandResult.denied());
            notice(player, notify, "locked_command");
        }
    }

    /** La conexion inicial se permite (si no, no entraria en ningun servidor); los cambios, no. */
    private void denyServerSwitch(ServerPreConnectEvent event, boolean notify) {
        Player player = event.getPlayer();
        if (core.settings().lockServerSwitch() && player.getCurrentServer().isPresent() && isLocked(player)) {
            event.setResult(ServerPreConnectEvent.ServerResult.denied());
            notice(player, notify, "locked_server_switch");
        }
    }

    private boolean isLocked(Player player) {
        return core.verifier().isLocked(player.getUniqueId());
    }

    private void notice(Player player, boolean notify, String messageKey) {
        if (notify) {
            core.verifier().noticeLocked(player.getUniqueId(), messageKey);
        }
    }
}
