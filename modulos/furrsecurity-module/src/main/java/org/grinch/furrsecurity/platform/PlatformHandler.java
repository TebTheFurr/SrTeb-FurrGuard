package org.grinch.furrsecurity.platform;

import net.kyori.adventure.text.Component;

import java.net.InetSocketAddress;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Operaciones de Velocity o Paper que necesita el nucleo. Todas son seguras desde cualquier hilo. */
public interface PlatformHandler {

    /** Nodos que marcan a un jugador como candidato a staff (en Paper tambien cuenta ser op). */
    List<String> STAFF_PERMISSIONS = List.of("*", "furrsecurity.staff", "furrguard.*");

    String name();

    /** {@code true} en Velocity: el modo proxy de config.yml solo tiene sentido en Paper. */
    boolean isProxy();

    /** En Paper, llamar desde el hilo principal. */
    Collection<PlayerInfo> onlinePlayers();

    Optional<PlayerInfo> findPlayer(String name);

    /** No envia nada si el mensaje esta vacio. */
    void sendMessage(UUID uuid, Component message);

    void broadcast(String permission, Component message);

    void kick(UUID uuid, Component reason);

    /** Efectos del bloqueo propios de la plataforma (Paper: ceguera, anclaje, bajar del vehiculo). */
    void onLock(UUID uuid);

    /** Deshace {@link #onLock}; en el hilo principal se ejecuta al momento (salida, onDisable). */
    void onUnlock(UUID uuid);

    /** Al momento si ya se esta en el hilo principal (Velocity no tiene: siempre al momento). */
    void runOnMain(Runnable task);

    TaskHandle schedule(Runnable task, long delayMillis);

    TaskHandle repeat(Runnable task, long delayMillis, long periodMillis);

    @FunctionalInterface
    interface TaskHandle {
        void cancel();
    }

    /**
     * @param handle objeto jugador de la plataforma: distingue dos conexiones con el mismo UUID
     */
    record PlayerInfo(UUID uuid, String nick, String ip, boolean staffPermission, Object handle) {
    }

    /** IP sin ambito IPv6 ({@code %eth0}); vacia si no se conoce (la API la rechazara y se sigue bloqueado). */
    static String hostAddress(InetSocketAddress address) {
        if (address == null || address.getAddress() == null) {
            return "";
        }
        String host = address.getAddress().getHostAddress();
        int scope = host.indexOf('%');
        return scope < 0 ? host : host.substring(0, scope);
    }
}
