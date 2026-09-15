package org.grinch.furrsecurity.paper;

import io.papermc.paper.event.player.AsyncChatEvent;
import org.bukkit.Location;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityMountEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.bukkit.event.hanging.HangingBreakByEntityEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractAtEntityEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerSwapHandItemsEvent;
import org.bukkit.event.vehicle.VehicleDamageEvent;
import org.bukkit.event.vehicle.VehicleEnterEvent;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.java.JavaPlugin;
import org.grinch.furrsecurity.FurrSecurity;
import org.grinch.furrsecurity.config.Settings;

import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Bloqueo en Paper. Cada accion se cancela en LOWEST y se vuelve a cancelar en HIGHEST, por si otro
 * plugin la descancela entre medias.
 */
final class PaperListener implements Listener {

    private static final List<EventPriority> PRIORITIES = List.of(EventPriority.LOWEST, EventPriority.HIGHEST);
    private static final Predicate<Settings> ALWAYS = settings -> true;

    private final FurrSecurity core;
    private final PaperHandler handler;

    PaperListener(FurrSecurity core, PaperHandler handler) {
        this.core = core;
        this.handler = handler;
    }

    void register(JavaPlugin plugin) {
        PluginManager events = plugin.getServer().getPluginManager();
        events.registerEvents(this, plugin);

        guard(events, plugin, BlockBreakEvent.class, BlockBreakEvent::getPlayer, ALWAYS, null);
        guard(events, plugin, BlockPlaceEvent.class, BlockPlaceEvent::getPlayer, ALWAYS, null);
        guard(events, plugin, PlayerInteractEvent.class, PlayerInteractEvent::getPlayer, ALWAYS, "locked_inventory");
        guard(events, plugin, PlayerInteractEntityEvent.class, PlayerInteractEntityEvent::getPlayer, ALWAYS, null);
        guard(events, plugin, PlayerInteractAtEntityEvent.class, PlayerInteractAtEntityEvent::getPlayer, ALWAYS, null);
        guard(events, plugin, HangingBreakByEntityEvent.class, HangingBreakByEntityEvent::getRemover, ALWAYS, null);
        guard(events, plugin, EntityDamageEvent.class, EntityDamageEvent::getEntity, ALWAYS, null);
        guard(events, plugin, EntityDamageByEntityEvent.class, event -> attacker(event.getDamager()), ALWAYS, null);
        guard(events, plugin, VehicleDamageEvent.class, event -> attacker(event.getAttacker()), ALWAYS, null);
        guard(events, plugin, EntityTargetEvent.class, EntityTargetEvent::getTarget, ALWAYS, null);

        guard(events, plugin, VehicleEnterEvent.class, VehicleEnterEvent::getEntered, Settings::lockMovement, "locked_movement");
        guard(events, plugin, EntityMountEvent.class, EntityMountEvent::getEntity, Settings::lockMovement, "locked_movement");

        guard(events, plugin, InventoryOpenEvent.class, InventoryOpenEvent::getPlayer, Settings::lockInventory, "locked_inventory");
        guard(events, plugin, InventoryClickEvent.class, InventoryClickEvent::getWhoClicked, Settings::lockInventory, "locked_inventory");
        guard(events, plugin, InventoryDragEvent.class, InventoryDragEvent::getWhoClicked, Settings::lockInventory, null);
        guard(events, plugin, PlayerDropItemEvent.class, PlayerDropItemEvent::getPlayer, Settings::lockInventory, null);
        guard(events, plugin, EntityPickupItemEvent.class, EntityPickupItemEvent::getEntity, Settings::lockInventory, null);
        guard(events, plugin, PlayerSwapHandItemsEvent.class, PlayerSwapHandItemsEvent::getPlayer, Settings::lockInventory, null);

        // Todos los comandos, tambien /fsec: un bloqueado no puede desbloquearse a si mismo
        guard(events, plugin, PlayerCommandPreprocessEvent.class, PlayerCommandPreprocessEvent::getPlayer,
                Settings::lockCommands, "locked_command");
        guard(events, plugin, AsyncChatEvent.class, AsyncChatEvent::getPlayer, Settings::lockChat, "locked_chat");
    }

    /** Antes que el resto de plugins: el candidato a staff queda bloqueado antes de poder hacer nada. */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent event) {
        core.verifier().onJoin(handler.info(event.getPlayer()), true);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        core.verifier().onQuit(event.getPlayer().getUniqueId(), event.getPlayer());
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onMoveFirst(PlayerMoveEvent event) {
        holdInPlace(event, true);
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onMoveLast(PlayerMoveEvent event) {
        holdInPlace(event, false);
    }

    /** Deja girar la cabeza pero devuelve al jugador a donde se le bloqueo. */
    private void holdInPlace(PlayerMoveEvent event, boolean notify) {
        Player player = event.getPlayer();
        if (!core.settings().lockMovement() || !core.verifier().isLocked(player.getUniqueId())) {
            return;
        }
        Location to = event.getTo();
        Location anchor = handler.anchor(player.getUniqueId());
        Location target = anchor != null ? anchor : event.getFrom();
        if (to.getWorld() == target.getWorld() && to.getX() == target.getX() && to.getY() == target.getY()
                && to.getZ() == target.getZ()) {
            return;
        }
        Location held = target.clone();
        held.setYaw(to.getYaw());
        held.setPitch(to.getPitch());
        event.setTo(held);
        if (notify) {
            core.verifier().noticeLocked(player.getUniqueId(), "locked_movement");
        }
    }

    private <E extends Event & Cancellable> void guard(PluginManager events, JavaPlugin plugin, Class<E> type,
                                                       Function<E, Entity> actor, Predicate<Settings> enabled,
                                                       String messageKey) {
        for (EventPriority priority : PRIORITIES) {
            boolean notify = messageKey != null && priority == EventPriority.LOWEST;
            EventExecutor executor = (listener, event) -> {
                // Los eventos sin HandlerList propia (EntityDamageByEntityEvent) llegan a la de su padre
                if (!type.isInstance(event)) {
                    return;
                }
                E typed = type.cast(event);
                if (actor.apply(typed) instanceof Player player && enabled.test(core.settings())
                        && core.verifier().isLocked(player.getUniqueId())) {
                    typed.setCancelled(true);
                    if (notify) {
                        core.verifier().noticeLocked(player.getUniqueId(), messageKey);
                    }
                }
            };
            events.registerEvent(type, this, priority, executor, plugin, false);
        }
    }

    private static Entity attacker(Entity damager) {
        return damager instanceof Projectile projectile && projectile.getShooter() instanceof Entity shooter
                ? shooter : damager;
    }
}
