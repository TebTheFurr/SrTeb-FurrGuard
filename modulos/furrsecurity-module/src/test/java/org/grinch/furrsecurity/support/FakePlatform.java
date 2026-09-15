package org.grinch.furrsecurity.support;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.grinch.furrsecurity.platform.PlatformHandler;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Plataforma en memoria con reloj virtual: las tareas solo corren con {@link #advance}. */
public final class FakePlatform implements PlatformHandler {

    public final Map<UUID, PlayerInfo> online = new LinkedHashMap<>();
    private final List<String> events;
    private final List<Task> tasks = new ArrayList<>();
    private final boolean proxy;
    private long now;

    public FakePlatform(List<String> events, boolean proxy) {
        this.events = events;
        this.proxy = proxy;
    }

    /** Ejecuta, en orden, las tareas que vencen en los proximos {@code millis}. */
    public void advance(long millis) {
        long target = now + millis;
        while (true) {
            Task next = tasks.stream().filter(task -> task.dueAt <= target)
                    .min(Comparator.comparingLong(task -> task.dueAt)).orElse(null);
            if (next == null) {
                break;
            }
            now = next.dueAt;
            if (next.period > 0) {
                next.dueAt += next.period;
            } else {
                tasks.remove(next);
            }
            next.action.run();
        }
        now = target;
    }

    public long pendingTasks() {
        return tasks.size();
    }

    public static String plain(Component component) {
        return PlainTextComponentSerializer.plainText().serialize(component);
    }

    @Override
    public String name() {
        return proxy ? "Velocity" : "Paper";
    }

    @Override
    public boolean isProxy() {
        return proxy;
    }

    @Override
    public Collection<PlayerInfo> onlinePlayers() {
        return List.copyOf(online.values());
    }

    @Override
    public Optional<PlayerInfo> findPlayer(String name) {
        return online.values().stream().filter(player -> player.nick().equalsIgnoreCase(name)).findFirst();
    }

    @Override
    public void sendMessage(UUID uuid, Component message) {
        if (!Component.empty().equals(message)) {
            events.add("msg:" + nick(uuid) + ":" + plain(message));
        }
    }

    @Override
    public void broadcast(String permission, Component message) {
        events.add("broadcast:" + permission + ":" + plain(message));
    }

    @Override
    public void kick(UUID uuid, Component reason) {
        events.add("kick:" + nick(uuid));
    }

    @Override
    public void onLock(UUID uuid) {
        events.add("lock:" + nick(uuid));
    }

    @Override
    public void onUnlock(UUID uuid) {
        events.add("unlock:" + nick(uuid));
    }

    @Override
    public void runOnMain(Runnable task) {
        task.run();
    }

    @Override
    public TaskHandle schedule(Runnable task, long delayMillis) {
        return add(new Task(task, now + delayMillis, 0));
    }

    @Override
    public TaskHandle repeat(Runnable task, long delayMillis, long periodMillis) {
        return add(new Task(task, now + delayMillis, periodMillis));
    }

    private TaskHandle add(Task task) {
        tasks.add(task);
        return () -> tasks.remove(task);
    }

    private String nick(UUID uuid) {
        PlayerInfo player = online.get(uuid);
        return player == null ? uuid.toString() : player.nick();
    }

    private static final class Task {
        final Runnable action;
        final long period;
        long dueAt;

        Task(Runnable action, long dueAt, long period) {
            this.action = action;
            this.dueAt = dueAt;
            this.period = period;
        }
    }
}
