package org.grinch.furrsecurity.paper;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.scheduler.BukkitTask;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.command.FurrSecurityCommand;
import org.grinch.furrsecurity.platform.PlatformHandler;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/** Paper: todo lo que toca a un jugador se hace en el hilo principal. */
public final class PaperHandler implements PlatformHandler {

    private static final long TICK_MILLIS = 50;
    private static final int BLINDNESS_TICKS = 200;       // duracion finita...
    private static final long BLINDNESS_RENEW_TICKS = 100; // ...que se renueva mientras dura el bloqueo

    private final JavaPlugin plugin;
    private final Map<UUID, Location> anchors = new ConcurrentHashMap<>();
    private FurrSecurity core;

    public PaperHandler(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    void bind(FurrSecurity core) {
        this.core = core;
        PluginCommand command = plugin.getCommand("furrsecurity");
        if (command == null) {
            throw new IllegalStateException("plugin.yml no declara el comando furrsecurity");
        }
        CommandBridge bridge = new CommandBridge(new FurrSecurityCommand(core));
        command.setExecutor(bridge);
        command.setTabCompleter(bridge);
        new PaperListener(core, this).register(plugin);
        Bukkit.getScheduler().runTaskTimer(plugin, this::renewBlindness, BLINDNESS_RENEW_TICKS, BLINDNESS_RENEW_TICKS);
    }

    PlayerInfo info(Player player) {
        boolean staff = player.isOp() || STAFF_PERMISSIONS.stream().anyMatch(player::hasPermission);
        return new PlayerInfo(player.getUniqueId(), player.getName(), PlatformHandler.hostAddress(player.getAddress()),
                staff, player);
    }

    /** Posicion en la que se bloqueo al jugador, o {@code null}. */
    Location anchor(UUID uuid) {
        return anchors.get(uuid);
    }

    @Override
    public String name() {
        return "Paper";
    }

    @Override
    public boolean isProxy() {
        return false;
    }

    @Override
    public Collection<PlayerInfo> onlinePlayers() {
        return Bukkit.getOnlinePlayers().stream().map(this::info).toList();
    }

    @Override
    public Optional<PlayerInfo> findPlayer(String name) {
        return Optional.ofNullable(Bukkit.getPlayerExact(name)).map(this::info);
    }

    @Override
    public void sendMessage(UUID uuid, Component message) {
        if (!Component.empty().equals(message)) {
            withPlayer(uuid, player -> player.sendMessage(message));
        }
    }

    @Override
    public void broadcast(String permission, Component message) {
        runOnMain(() -> Bukkit.getOnlinePlayers().stream()
                .filter(player -> player.hasPermission(permission))
                .forEach(player -> player.sendMessage(message)));
    }

    @Override
    public void kick(UUID uuid, Component reason) {
        withPlayer(uuid, player -> player.kick(reason));
    }

    @Override
    public void onLock(UUID uuid) {
        withPlayer(uuid, player -> {
            if (!core.verifier().isLocked(uuid)) {
                return;
            }
            anchors.put(uuid, player.getLocation());
            player.leaveVehicle();
            if (core.settings().lockInventory()) {
                player.closeInventory();
            }
            blind(player);
        });
    }

    @Override
    public void onUnlock(UUID uuid) {
        runOnMain(() -> {
            if (core.verifier().isLocked(uuid)) {
                return; // se volvio a bloquear antes de llegar aqui
            }
            anchors.remove(uuid);
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                player.removePotionEffect(PotionEffectType.BLINDNESS);
            }
        });
    }

    @Override
    public void runOnMain(Runnable task) {
        if (Bukkit.isPrimaryThread()) {
            task.run();
        } else if (plugin.isEnabled()) {
            Bukkit.getScheduler().runTask(plugin, task);
        }
    }

    @Override
    public TaskHandle schedule(Runnable task, long delayMillis) {
        if (!plugin.isEnabled()) {
            return () -> { };
        }
        BukkitTask scheduled = Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, task, ticks(delayMillis));
        return scheduled::cancel;
    }

    @Override
    public TaskHandle repeat(Runnable task, long delayMillis, long periodMillis) {
        if (!plugin.isEnabled()) {
            return () -> { };
        }
        BukkitTask scheduled = Bukkit.getScheduler()
                .runTaskTimerAsynchronously(plugin, task, ticks(delayMillis), Math.max(1, ticks(periodMillis)));
        return scheduled::cancel;
    }

    private void renewBlindness() {
        for (UUID uuid : core.verifier().lockedPlayers()) {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                blind(player);
            }
        }
    }

    private void withPlayer(UUID uuid, Consumer<Player> action) {
        runOnMain(() -> {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                action.accept(player);
            }
        });
    }

    private static void blind(Player player) {
        player.addPotionEffect(new PotionEffect(PotionEffectType.BLINDNESS, BLINDNESS_TICKS, 0, false, false, false));
    }

    private static long ticks(long millis) {
        return Math.max(0, (millis + TICK_MILLIS - 1) / TICK_MILLIS);
    }

    private record CommandBridge(FurrSecurityCommand command) implements TabExecutor {

        @Override
        public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
            command.execute(wrap(sender), args);
            return true;
        }

        @Override
        public List<String> onTabComplete(CommandSender sender, Command cmd, String alias, String[] args) {
            return sender.hasPermission(FurrSecurityCommand.ADMIN_PERMISSION) ? command.suggest(args) : List.of();
        }

        private static FurrSecurityCommand.Sender wrap(CommandSender sender) {
            return new FurrSecurityCommand.Sender() {
                @Override
                public void sendMessage(Component message) {
                    sender.sendMessage(message);
                }

                @Override
                public boolean hasPermission(String permission) {
                    return sender.hasPermission(permission);
                }
            };
        }
    }
}
