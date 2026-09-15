package org.grinch.furrsecurity.velocity;

import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.command.CommandMeta;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.platform.PlatformHandler;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/** Velocity: la API es segura desde cualquier hilo y no hay efectos de bloqueo propios (los pone Paper). */
final class VelocityHandler implements PlatformHandler {

    private final Object plugin;
    private final ProxyServer server;
    private CommandMeta commandMeta;

    VelocityHandler(Object plugin, ProxyServer server) {
        this.plugin = plugin;
        this.server = server;
    }

    void bind(FurrSecurity core) {
        server.getEventManager().register(plugin, new VelocityListener(core, this));
        CommandManager commands = server.getCommandManager();
        commandMeta = commands.metaBuilder("furrsecurity").aliases("fsec", "fs").plugin(plugin).build();
        commands.register(commandMeta, new CommandBridge(new FurrSecurityCommand(core)));
    }

    void unbind() {
        server.getEventManager().unregisterListeners(plugin);
        if (commandMeta != null) {
            server.getCommandManager().unregister(commandMeta);
        }
    }

    PlayerInfo info(Player player) {
        return new PlayerInfo(player.getUniqueId(), player.getUsername(),
                PlatformHandler.hostAddress(player.getRemoteAddress()),
                STAFF_PERMISSIONS.stream().anyMatch(player::hasPermission), player);
    }

    @Override
    public String name() {
        return "Velocity";
    }

    @Override
    public boolean isProxy() {
        return true;
    }

    @Override
    public Collection<PlayerInfo> onlinePlayers() {
        return server.getAllPlayers().stream().map(this::info).toList();
    }

    @Override
    public Optional<PlayerInfo> findPlayer(String name) {
        return server.getPlayer(name).map(this::info);
    }

    @Override
    public void sendMessage(UUID uuid, Component message) {
        if (!Component.empty().equals(message)) {
            server.getPlayer(uuid).ifPresent(player -> player.sendMessage(message));
        }
    }

    @Override
    public void broadcast(String permission, Component message) {
        server.getAllPlayers().stream()
                .filter(player -> player.hasPermission(permission))
                .forEach(player -> player.sendMessage(message));
    }

    @Override
    public void kick(UUID uuid, Component reason) {
        server.getPlayer(uuid).ifPresent(player -> player.disconnect(reason));
    }

    @Override
    public void onLock(UUID uuid) {
        // comandos, chat y cambio de servidor los filtra VelocityListener
    }

    @Override
    public void onUnlock(UUID uuid) {
        // nada que deshacer en el proxy
    }

    @Override
    public void runOnMain(Runnable task) {
        task.run();
    }

    @Override
    public TaskHandle schedule(Runnable task, long delayMillis) {
        ScheduledTask scheduled = server.getScheduler().buildTask(plugin, task)
                .delay(delayMillis, TimeUnit.MILLISECONDS).schedule();
        return scheduled::cancel;
    }

    @Override
    public TaskHandle repeat(Runnable task, long delayMillis, long periodMillis) {
        ScheduledTask scheduled = server.getScheduler().buildTask(plugin, task)
                .delay(delayMillis, TimeUnit.MILLISECONDS)
                .repeat(periodMillis, TimeUnit.MILLISECONDS).schedule();
        return scheduled::cancel;
    }

    private record CommandBridge(FurrSecurityCommand command) implements SimpleCommand {

        @Override
        public void execute(Invocation invocation) {
            command.execute(sender(invocation), invocation.arguments());
        }

        @Override
        public List<String> suggest(Invocation invocation) {
            return command.suggest(invocation.arguments());
        }

        @Override
        public boolean hasPermission(Invocation invocation) {
            return invocation.source().hasPermission(FurrSecurityCommand.ADMIN_PERMISSION);
        }

        private static FurrSecurityCommand.Sender sender(Invocation invocation) {
            return new FurrSecurityCommand.Sender() {
                @Override
                public void sendMessage(Component message) {
                    invocation.source().sendMessage(message);
                }

                @Override
                public boolean hasPermission(String permission) {
                    return invocation.source().hasPermission(permission);
                }
            };
        }
    }
}
